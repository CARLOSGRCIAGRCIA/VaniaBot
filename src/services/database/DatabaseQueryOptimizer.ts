import { createCache, type LruMemoryCache } from '../system/MemoryCacheService.js';

export interface QueryOptions {
  cache?: boolean;
  cacheTtl?: number;
  batch?: boolean;
  batchKey?: string;
  batchTimeout?: number;
}

export interface QueryStats {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  batchedQueries: number;
}

const DEFAULT_OPTIONS: Required<QueryOptions> = {
  cache: true,
  cacheTtl: 30000,
  batch: false,
  batchKey: 'default',
  batchTimeout: 100,
};

export class DatabaseQueryOptimizer {
  private static instance: DatabaseQueryOptimizer;
  private cache: LruMemoryCache<unknown>;
  private batchQueues: Map<
    string,
    Array<{ resolve: (value: unknown) => void; reject: (reason: unknown) => void; key: string }>
  > = new Map();
  private batchTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private stats: QueryStats = {
    totalQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    batchedQueries: 0,
  };

  private constructor() {
    this.cache = createCache<unknown>({
      maxSize: 5000,
      ttl: 30000,
      cleanupInterval: 60000,
    });
  }

  static getInstance(): DatabaseQueryOptimizer {
    if (!DatabaseQueryOptimizer.instance) {
      DatabaseQueryOptimizer.instance = new DatabaseQueryOptimizer();
    }
    return DatabaseQueryOptimizer.instance;
  }

  async query<T>(key: string, queryFn: () => Promise<T>, options: QueryOptions = {}): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.stats.totalQueries++;

    if (opts.cache) {
      const cached = this.cache.get(key) as T | undefined;
      if (cached !== undefined) {
        this.stats.cacheHits++;
        return cached;
      }
      this.stats.cacheMisses++;
    }

    let result: T;

    if (opts.batch) {
      result = (await this.batchQuery(key, queryFn, opts)) as T;
    } else {
      result = await queryFn();
    }

    if (opts.cache) {
      this.cache.set(key, result, opts.cacheTtl / 1000);
    }

    return result;
  }

  private async batchQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    opts: Required<QueryOptions>,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.batchQueues.has(opts.batchKey)) {
        this.batchQueues.set(opts.batchKey, []);
      }

      const queue = this.batchQueues.get(opts.batchKey);
      if (!queue) return;

      queue.push({
        key,
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      const existingTimeout = this.batchTimeouts.get(opts.batchKey);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      this.batchTimeouts.set(
        opts.batchKey,
        setTimeout(async () => {
          await this.flushBatch(opts.batchKey);
        }, opts.batchTimeout),
      );
    });
  }

  private async flushBatch(batchKey: string): Promise<void> {
    const queue = this.batchQueues.get(batchKey);
    if (!queue || queue.length === 0) return;

    this.batchQueues.delete(batchKey);
    this.batchTimeouts.delete(batchKey);

    const uniqueKeys = [...new Set(queue.map(q => q.key))];

    const promises = uniqueKeys.map(async key => {
      const cached = this.cache.get(key);
      if (cached !== undefined) {
        return { key, result: cached, fromCache: true };
      }
      return null;
    });

    const cachedResults = await Promise.all(promises);
    const uncachedKeys = cachedResults.filter(r => r === null).map((_, i) => uniqueKeys[i]);

    if (uncachedKeys.length > 0) {
      this.stats.batchedQueries += uncachedKeys.length;
    }

    for (const item of queue) {
      const cached = this.cache.get(item.key);
      if (cached !== undefined) {
        item.resolve(cached);
      } else {
        item.reject(new Error(`Query not found: ${item.key}`));
      }
    }
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string): void {
    const entries = this.cache.getEntries();
    for (const entry of entries) {
      if (entry.key.includes(pattern)) {
        this.cache.delete(entry.key);
      }
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  getStats(): QueryStats & {
    cacheStats: {
      size: number;
      hits: number;
      misses: number;
      sets: number;
      evictions: number;
      hitRate: string;
    };
  } {
    return {
      ...this.stats,
      cacheStats: this.cache.getStats(),
    };
  }
}

export const queryOptimizer = DatabaseQueryOptimizer.getInstance();
