import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { Database } from "./Database.js";
import { logger, logError } from "@/utils/logger.js";

interface JsonData {
  [collection: string]: {
    [key: string]: any;
  };
}

class MemoryCache {
  private cache = new Map<string, any>();
  private maxSize = 10000;
  private hits = 0;
  private misses = 0;

  get(collection: string, key: string): any | undefined {
    const cacheKey = `${collection}:${key}`;
    const value = this.cache.get(cacheKey);

    if (value !== undefined) {
      this.hits++;
      return value;
    }

    this.misses++;
    return undefined;
  }

  set(collection: string, key: string, value: any): void {
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
    const cacheKey = `${collection}:${key}`;
    this.cache.delete(cacheKey);
  }

  clear(collection?: string): void {
    if (collection) {
      const keysToDelete: string[] = [];
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${collection}:`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach((key) => this.cache.delete(key));
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
      hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(2) + "%" : "0%",
    };
  }
}

export class JsonDatabase extends Database {
  private data: JsonData = {};
  private filePath: string;
  private saveTimeout: NodeJS.Timeout | null = null;
  private pendingWrites = new Set<string>();
  private cache = new MemoryCache();

  private readonly SAVE_DELAY = 2000;
  private readonly FORCE_SAVE_INTERVAL = 30000;
  private forceSaveTimer: NodeJS.Timeout | null = null;
  private lastSaveTime = Date.now();
  private isSaving = false;

  constructor(filePath: string = "./data/database.json") {
    super();
    this.filePath = filePath;
  }

  async connect(): Promise<void> {
    try {
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      if (existsSync(this.filePath)) {
        const rawData = readFileSync(this.filePath, "utf-8");
        this.data = JSON.parse(rawData);
        logger.info(`✅ Base de datos JSON cargada: ${this.filePath}`);
      } else {
        this.data = {};
        this.saveNow();
        logger.info(`✅ Nueva base de datos JSON creada: ${this.filePath}`);
      }

      this.connected = true;

      this.startForceSaveTimer();
    } catch (error) {
      logError("JsonDatabase.connect", error);
      throw new Error("Error al conectar con la base de datos JSON");
    }
  }

  async disconnect(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    if (this.forceSaveTimer) {
      clearInterval(this.forceSaveTimer);
      this.forceSaveTimer = null;
    }

    await this.saveNow();

    this.connected = false;

    const stats = this.cache.getStats();
    logger.info(
      `📊 Caché DB: ${stats.size} entradas, ${stats.hitRate} hit rate`,
    );
    logger.info("✅ Base de datos JSON desconectada");
  }

  private ensureCollection(collection: string): void {
    if (!this.data[collection]) {
      this.data[collection] = {};
    }
  }

  private scheduleSave(collection?: string): void {
    if (collection) {
      this.pendingWrites.add(collection);
    }

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.saveNow().catch((err) => logError("scheduleSave", err));
    }, this.SAVE_DELAY);
  }

  private async saveNow(): Promise<void> {
    if (this.isSaving) {
      return;
    }

    if (
      this.pendingWrites.size === 0 &&
      Date.now() - this.lastSaveTime < this.SAVE_DELAY
    ) {
      return;
    }

    this.isSaving = true;

    try {
      await new Promise<void>((resolve, reject) => {
        try {
          writeFileSync(
            this.filePath,
            JSON.stringify(this.data, null, 2),
            "utf-8",
          );
          this.pendingWrites.clear();
          this.lastSaveTime = Date.now();
          resolve();
        } catch (error) {
          logError("JsonDatabase.saveNow", error);
          reject(error);
        }
      });
    } finally {
      this.isSaving = false;
    }
  }

  private startForceSaveTimer(): void {
    this.forceSaveTimer = setInterval(() => {
      if (this.pendingWrites.size > 0) {
        this.saveNow().catch((err) => logError("forceSave", err));
      }
    }, this.FORCE_SAVE_INTERVAL);
  }

  async get<T>(collection: string, key: string): Promise<T | null> {
    const cached = this.cache.get(collection, key);
    if (cached !== undefined) {
      return cached as T;
    }

    this.ensureCollection(collection);
    const value = this.data[collection][key] || null;

    if (value !== null) {
      this.cache.set(collection, key, value);
    }

    return value;
  }

  async set<T>(collection: string, key: string, value: T): Promise<void> {
    this.ensureCollection(collection);
    this.data[collection][key] = value;

    this.cache.set(collection, key, value);

    this.scheduleSave(collection);
  }

  async delete(collection: string, key: string): Promise<boolean> {
    this.ensureCollection(collection);

    if (this.data[collection][key]) {
      delete this.data[collection][key];

      this.cache.delete(collection, key);

      this.scheduleSave(collection);
      return true;
    }

    return false;
  }

  async has(collection: string, key: string): Promise<boolean> {
    const cached = this.cache.get(collection, key);
    if (cached !== undefined) {
      return true;
    }

    this.ensureCollection(collection);
    return key in this.data[collection];
  }

  async find<T>(collection: string, filter: Record<string, any>): Promise<T[]> {
    this.ensureCollection(collection);
    const results: T[] = [];

    const values = Object.values(this.data[collection]);

    for (const value of values) {
      let matches = true;

      for (const [filterKey, filterValue] of Object.entries(filter)) {
        if (value[filterKey] !== filterValue) {
          matches = false;
          break;
        }
      }

      if (matches) {
        results.push(value as T);
      }
    }

    return results;
  }

  async findOne<T>(
    collection: string,
    filter: Record<string, any>,
  ): Promise<T | null> {
    this.ensureCollection(collection);

    for (const value of Object.values(this.data[collection])) {
      let matches = true;

      for (const [filterKey, filterValue] of Object.entries(filter)) {
        if (value[filterKey] !== filterValue) {
          matches = false;
          break;
        }
      }

      if (matches) {
        return value as T;
      }
    }

    return null;
  }

  async update<T>(
    collection: string,
    key: string,
    updates: Partial<T>,
  ): Promise<void> {
    this.ensureCollection(collection);

    if (this.data[collection][key]) {
      this.data[collection][key] = {
        ...this.data[collection][key],
        ...updates,
      };

      this.cache.set(collection, key, this.data[collection][key]);

      this.scheduleSave(collection);
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

    await this.saveNow();
  }

  async flush(): Promise<void> {
    await this.saveNow();
  }

  getCacheStats() {
    return this.cache.getStats();
  }
}
