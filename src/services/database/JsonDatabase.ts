import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { Database } from './Database.js';
import type { PaginatedResult } from './Database.js';
import { logger, logError } from '@/utils/logger.js';
import { BatchWriter } from './BatchWriter.js';
import { cacheManager } from '@/core/CacheManager.js';
import type { CachedUser } from '@/core/CacheManager.js';
import { ErrorHandler } from '@/utils/ErrorHandler.js';
import { databaseMigration } from './DatabaseMigration.js';

type JsonDataCollection = Record<string, unknown>;

interface RawJsonData {
  _meta?: JsonDataCollection;
  [key: string]: JsonDataCollection | undefined;
}

interface JsonData {
  _meta: JsonDataCollection;
  [key: string]: JsonDataCollection;
}

class UnifiedCache {
  private hits = 0;
  private misses = 0;

  get(collection: string, key: string): unknown {
    if (collection === 'users') {
      const cached = cacheManager.getUser(key);
      if (cached !== null) {
        this.hits++;
        return cached;
      }
    }

    const cached = this.getFromCache(collection, key);
    if (cached !== undefined) {
      this.hits++;
      return cached;
    }

    this.misses++;
    return undefined;
  }

  set(collection: string, key: string, value: unknown): void {
    if (collection === 'users' && typeof value === 'object' && value !== null) {
      cacheManager.setUser(key, value as CachedUser);
    }
    this.setToCache(collection, key, value);
  }

  delete(collection: string, key: string): void {
    if (collection === 'users') {
      cacheManager.invalidateUser(key);
    }
    this.deleteFromCache(collection, key);
  }

  clear(collection?: string): void {
    if (collection) {
      for (const key of [...this.cacheKeys(collection)]) {
        this.deleteFromCache(collection, key);
      }
      if (collection === 'users') {
        for (const key of this.getAllUserKeys()) {
          cacheManager.invalidateUser(key);
        }
      }
    }
  }

  getStats() {
    const cacheStats = cacheManager.getStats();
    const total = this.hits + this.misses;
    return {
      hits:
        this.hits +
        (parseInt(cacheStats.hitRate) > 0
          ? Math.floor((this.hits * parseFloat(cacheStats.hitRate)) / 100)
          : 0),
      misses: this.misses,
      hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(2) + '%' : '0%',
      size: this.cache.size + cacheManager.getStats().sizes.users,
    };
  }

  private cache = new Map<string, unknown>();
  private readonly maxSize = 5000;

  private getCacheKey(collection: string, key: string): string {
    return `${collection}:${key}`;
  }

  private getFromCache(collection: string, key: string): unknown {
    const cacheKey = this.getCacheKey(collection, key);
    return this.cache.get(cacheKey);
  }

  private setToCache(collection: string, key: string, value: unknown): void {
    const cacheKey = this.getCacheKey(collection, key);

    if (this.cache.size >= this.maxSize && !this.cache.has(cacheKey)) {
      const firstKey = this.cache.keys().next();
      if (!firstKey.done) {
        this.cache.delete(firstKey.value);
      }
    }

    this.cache.set(cacheKey, value);
  }

  private deleteFromCache(collection: string, key: string): void {
    const cacheKey = this.getCacheKey(collection, key);
    this.cache.delete(cacheKey);
  }

  private cacheKeys(collection: string): string[] {
    const prefix = `${collection}:`;
    return [...this.cache.keys()].filter(k => k.startsWith(prefix));
  }

  private getAllUserKeys(): string[] {
    const usersData = this.cache.get('__users__') as string[] | undefined;
    return usersData || [];
  }
}

const CRITICAL_COLLECTIONS = ['users', 'groups', 'settings', 'economy', 'levels'];

export class JsonDatabase extends Database {
  private data!: JsonData;
  private filePath: string;
  private batchWriter: BatchWriter;
  private cache = new UnifiedCache();

  constructor(filePath: string = './data/database.json') {
    super();
    this.filePath = filePath;
    this.batchWriter = new BatchWriter(async writes => {
      for (const write of writes) {
        if (!this.data[write.collection]) {
          this.data[write.collection] = {};
        }
        this.data[write.collection][write.key] = write.value;
      }
      await this.saveToFile();
    }, filePath);

    for (const col of CRITICAL_COLLECTIONS) {
      this.batchWriter.markCritical(col);
    }
  }

  async connect(): Promise<void> {
    try {
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      if (existsSync(this.filePath)) {
        const rawData = readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(rawData) as RawJsonData;
        this.data = this.ensureDataStructure(parsed);
        await this.runMigrations();
        if (process.env.NODE_ENV !== 'production') {
          logger.info(`DB cargada: ${this.filePath}`);
        }
      } else {
        this.data = { _meta: { version: 0 } };
        await this.runMigrations();
        await this.saveToFile();
      }
      this.connected = true;
    } catch (error) {
      logError('JsonDatabase.connect', error);
      throw new Error('Error al conectar con la base de datos JSON');
    }
  }

  private ensureDataStructure(raw: RawJsonData): JsonData {
    const result: JsonData = { _meta: raw._meta ?? { version: 0 } };
    for (const [key, value] of Object.entries(raw)) {
      if (key !== '_meta' && value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }

  private async runMigrations(): Promise<void> {
    try {
      const newVersion = await databaseMigration.migrate(this.data);
      if (newVersion > 0) {
        await this.saveToFile();
      }
    } catch (error) {
      logError('JsonDatabase.runMigrations', error);
    }
  }

  private async saveToFile(): Promise<void> {
    try {
      writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      logError('JsonDatabase.saveToFile', error);
      throw error;
    }
  }

  private ensureCollection(collection: string): void {
    if (!this.data[collection]) {
      this.data[collection] = {};
    }
  }

  async get<T>(collection: string, key: string): Promise<T | null> {
    const cached = this.cache.get(collection, key);
    if (cached !== undefined) return cached as T;

    this.ensureCollection(collection);
    const value = this.data[collection][key] ?? null;
    if (value !== null) {
      this.cache.set(collection, key, value);
    }
    return value as T | null;
  }

  async set<T>(collection: string, key: string, value: T): Promise<void> {
    this.ensureCollection(collection);
    this.data[collection][key] = value as unknown;
    this.cache.set(collection, key, value);
    this.batchWriter.schedule(collection, key, value);
  }

  async delete(collection: string, key: string): Promise<boolean> {
    this.ensureCollection(collection);
    if (this.data[collection][key] !== undefined) {
      delete this.data[collection][key];
      this.cache.delete(collection, key);
      this.batchWriter.schedule(collection, key, undefined);
      return true;
    }
    return false;
  }

  async has(collection: string, key: string): Promise<boolean> {
    const cached = this.cache.get(collection, key);
    if (cached !== undefined) return true;
    this.ensureCollection(collection);
    return key in this.data[collection];
  }

  async find<T>(collection: string, filter: Record<string, unknown>): Promise<T[]> {
    this.ensureCollection(collection);
    const results: T[] = [];
    for (const value of Object.values(this.data[collection])) {
      const record = value as Record<string, unknown>;
      let matches = true;
      for (const [filterKey, filterValue] of Object.entries(filter)) {
        if (record[filterKey] !== filterValue) {
          matches = false;
          break;
        }
      }
      if (matches) results.push(value as T);
    }
    return results;
  }

  async findOne<T>(collection: string, filter: Record<string, unknown>): Promise<T | null> {
    this.ensureCollection(collection);
    for (const value of Object.values(this.data[collection])) {
      const record = value as Record<string, unknown>;
      let matches = true;
      for (const [filterKey, filterValue] of Object.entries(filter)) {
        if (record[filterKey] !== filterValue) {
          matches = false;
          break;
        }
      }
      if (matches) return value as T;
    }
    return null;
  }

  async update<T>(collection: string, key: string, updates: Partial<T>): Promise<void> {
    this.ensureCollection(collection);
    if (this.data[collection][key] !== undefined) {
      const updated = { ...this.data[collection][key], ...updates };
      await this.set(collection, key, updated);
    } else {
      throw new Error(`Key ${key} not found in collection ${collection}`);
    }
  }

  async getAll<T>(collection: string): Promise<T[]> {
    this.ensureCollection(collection);
    return Object.values(this.data[collection]) as T[];
  }

  async getPaginated<T>(
    collection: string,
    options: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      filter?: Record<string, unknown>;
    } = {},
  ): Promise<PaginatedResult<T>> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const sortBy = options.sortBy;
    const sortOrder = options.sortOrder ?? 'desc';
    const filter = options.filter ?? {};

    let items = await this.find<T>(collection, filter);

    if (sortBy) {
      items = items.sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[sortBy];
        const bVal = (b as Record<string, unknown>)[sortBy];

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        }

        const aStr = String(aVal ?? '');
        const bStr = String(bVal ?? '');
        return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }

    const total = items.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paginatedItems = items.slice(start, start + limit);

    return {
      items: paginatedItems,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async count(collection: string, filter?: Record<string, unknown>): Promise<number> {
    if (!filter || Object.keys(filter).length === 0) {
      this.ensureCollection(collection);
      return Object.keys(this.data[collection]).length;
    }
    const results = await this.find(collection, filter);
    return results.length;
  }

  async clear(collection: string): Promise<void> {
    this.data[collection] = {};
    this.cache.clear(collection);
    await this.saveToFile();
  }

  async disconnect(): Promise<void> {
    await this.batchWriter.flushNow();
    this.connected = false;
    const stats = this.cache.getStats();
    if (parseInt(stats.hitRate) > 0) {
      logger.info(`Cache DB: ${stats.hitRate} hit rate`);
    }
  }

  async flush(): Promise<void> {
    await this.batchWriter.flushNow();
  }

  getCacheStats() {
    return this.cache.getStats();
  }

  async retryOperation<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    return ErrorHandler.retry(operation, {
      maxRetries: 3,
      delayMs: 500,
      onRetry: (attempt, error) => {
        logger.warn(
          `JsonDB ${operationName} retry ${attempt}: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      },
    });
  }
}
