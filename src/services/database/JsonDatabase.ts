import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { Database } from './Database.js';
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

class MemoryCache {
  private cache = new Map<string, unknown>();
  private readonly maxSize = 10000;
  private hits = 0;
  private misses = 0;

  get(collection: string, key: string): unknown {
    const cacheKey = `${collection}:${key}`;
    const value = this.cache.get(cacheKey);
    if (value !== undefined) {
      this.hits++;
      return value;
    }
    this.misses++;
    return undefined;
  }

  set(collection: string, key: string, value: unknown): void {
    const cacheKey = `${collection}:${key}`;
    if (this.cache.size >= this.maxSize) {
      const iterator = this.cache.keys();
      const firstKey = iterator.next();
      if (!firstKey.done && firstKey.value !== undefined) {
        this.cache.delete(firstKey.value);
      }
    }
    this.cache.set(cacheKey, value);
  }

  delete(collection: string, key: string): void {
    this.cache.delete(`${collection}:${key}`);
  }

  clear(collection?: string): void {
    if (collection) {
      for (const key of [...this.cache.keys()]) {
        if (key.startsWith(`${collection}:`)) this.cache.delete(key);
      }
    } else {
      this.cache.clear();
    }
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(2) + '%' : '0%',
    };
  }
}

export class JsonDatabase extends Database {
  private data!: JsonData;
  private filePath: string;
  private batchWriter: BatchWriter;
  private cache = new MemoryCache();

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
    });
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
    if (collection === 'users') {
      const cached = cacheManager.getUser(key);
      if (cached !== null) return cached as unknown as T;
    }

    const localCached = this.cache.get(collection, key);
    if (localCached !== undefined) return localCached as T;

    this.ensureCollection(collection);
    const value = this.data[collection][key] ?? null;
    if (value !== null) {
      this.cache.set(collection, key, value);
      if (collection === 'users') {
        cacheManager.setUser(key, value as CachedUser);
      }
    }
    return value as T | null;
  }

  async set<T>(collection: string, key: string, value: T): Promise<void> {
    this.ensureCollection(collection);
    this.data[collection][key] = value as unknown;
    this.cache.set(collection, key, value);
    if (collection === 'users') {
      cacheManager.setUser(key, value as unknown as CachedUser);
    }
    this.batchWriter.schedule(collection, key, value);
  }

  async delete(collection: string, key: string): Promise<boolean> {
    this.ensureCollection(collection);
    if (this.data[collection][key] !== undefined) {
      delete this.data[collection][key];
      this.cache.delete(collection, key);
      if (collection === 'users') {
        cacheManager.invalidateUser(key);
      }
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
