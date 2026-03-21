export interface CacheEntry<T> {
  value: T;
  expiry: number;
  hits: number;
  lastAccessed: number;
}

export interface MemoryCacheOptions {
  maxSize: number;
  ttl: number;
  cleanupInterval: number;
}

const DEFAULT_OPTIONS: MemoryCacheOptions = {
  maxSize: 1000,
  ttl: 300000,
  cleanupInterval: 60000,
};

import { logError } from '@/utils/logger.js';

export class LruMemoryCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private options: MemoryCacheOptions;
  private cleanupTimer: NodeJS.Timeout | null = null;

  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
  };

  constructor(options: Partial<MemoryCacheOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.startCleanup();
  }

  set(key: string, value: T, ttl?: number): void {
    const expiry = Date.now() + (ttl || this.options.ttl);

    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    if (this.cache.size >= this.options.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      expiry,
      hits: 0,
      lastAccessed: Date.now(),
    });

    this.stats.sets++;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    entry.hits++;
    entry.lastAccessed = Date.now();

    this.cache.delete(key);
    this.cache.set(key, entry);

    this.stats.hits++;
    return entry.value;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      try {
        this.cleanup();
      } catch (error) {
        logError('[LruMemoryCache] Cleanup error', error);
      }
    }, this.options.cleanupInterval);

    this.cleanupTimer.unref();
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.stats.evictions += cleaned;
    }

    if (this.cache.size > this.options.maxSize) {
      const excess = this.cache.size - this.options.maxSize;
      for (let i = 0; i < excess; i++) {
        this.evictOldest();
      }
    }
  }

  getOrSet(key: string, factory: () => T | Promise<T>, ttl?: number): T | Promise<T> {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = factory();
    if (value instanceof Promise) {
      return value.then(resolved => {
        this.set(key, resolved, ttl);
        return resolved;
      });
    }

    this.set(key, value, ttl);
    return value;
  }

  async getOrSetAsync(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): {
    size: number;
    hits: number;
    misses: number;
    sets: number;
    evictions: number;
    hitRate: string;
  } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) : '0.00';

    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      evictions: this.stats.evictions,
      hitRate: `${hitRate}%`,
    };
  }

  getEntries(): Array<{ key: string; hits: number; lastAccessed: number; size: number }> {
    const entries: Array<{ key: string; hits: number; lastAccessed: number; size: number }> = [];

    for (const [key, entry] of this.cache.entries()) {
      entries.push({
        key,
        hits: entry.hits,
        lastAccessed: entry.lastAccessed,
        size: JSON.stringify(entry.value).length,
      });
    }

    return entries.sort((a, b) => b.hits - a.hits);
  }
}

export const globalCache = new LruMemoryCache<unknown>({
  maxSize: 5000,
  ttl: 300000,
  cleanupInterval: 60000,
});

export function createCache<T>(options?: Partial<MemoryCacheOptions>): LruMemoryCache<T> {
  return new LruMemoryCache<T>(options);
}
