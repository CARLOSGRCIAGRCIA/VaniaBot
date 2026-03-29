/* eslint-disable @typescript-eslint/no-explicit-any */
import { LRUCache } from 'lru-cache';

interface MiddlewareCacheOptions {
  maxSize: number;
  ttlMs: number;
}

export class MiddlewareCache {
  private cache: LRUCache<string, any>;
  private readonly ttlMs: number;

  constructor(options: MiddlewareCacheOptions) {
    this.ttlMs = options.ttlMs;
    this.cache = new LRUCache<string, any>({
      max: options.maxSize,
      ttl: options.ttlMs,
      updateAgeOnGet: true,
      allowStale: false,
    });
  }

  get<T>(key: string): T | undefined {
    return this.cache.get(key) as T | undefined;
  }

  set<T>(key: string, value: T): void {
    this.cache.set(key, value);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export class MiddlewareCacheManager {
  private static instance: MiddlewareCacheManager;

  readonly groupEnabled: MiddlewareCache;
  readonly userMuted: MiddlewareCache;
  readonly userPermissions: MiddlewareCache;
  readonly onlyAdminMode: MiddlewareCache;

  private constructor() {
    this.groupEnabled = new MiddlewareCache({
      maxSize: 200,
      ttlMs: 30 * 1000,
    });

    this.userMuted = new MiddlewareCache({
      maxSize: 500,
      ttlMs: 10 * 1000,
    });

    this.userPermissions = new MiddlewareCache({
      maxSize: 300,
      ttlMs: 60 * 1000,
    });

    this.onlyAdminMode = new MiddlewareCache({
      maxSize: 200,
      ttlMs: 30 * 1000,
    });
  }

  static getInstance(): MiddlewareCacheManager {
    if (!MiddlewareCacheManager.instance) {
      MiddlewareCacheManager.instance = new MiddlewareCacheManager();
    }
    return MiddlewareCacheManager.instance;
  }

  invalidateGroup(groupJid: string): void {
    this.groupEnabled.invalidateByPrefix(groupJid + ':');
    this.onlyAdminMode.invalidateByPrefix(groupJid + ':');
  }

  invalidateUser(userJid: string): void {
    this.userMuted.invalidateByPrefix(userJid + ':');
    this.userPermissions.invalidateByPrefix(userJid + ':');
  }

  invalidateAll(): void {
    this.groupEnabled.clear();
    this.userMuted.clear();
    this.userPermissions.clear();
    this.onlyAdminMode.clear();
  }

  clear(): void {
    this.invalidateAll();
  }
}

export const middlewareCache = MiddlewareCacheManager.getInstance();
