import { LRUCache } from "lru-cache";

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

export class UnifiedCacheManager {
  private permissionsCache: LRUCache<string, any>;

  private groupMetadataCache: LRUCache<string, any>;

  private userCache: LRUCache<string, any>;

  private messageIdCache: Set<string>;

  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor() {
    this.permissionsCache = new LRUCache({
      max: 1000,
      ttl: 3 * 60 * 1000,
      updateAgeOnGet: true,
      allowStale: false,
    });

    this.groupMetadataCache = new LRUCache({
      max: 500,
      ttl: 10 * 60 * 1000,
      updateAgeOnGet: true,
    });

    this.userCache = new LRUCache({
      max: 5000,
      ttl: 30 * 60 * 1000,
      updateAgeOnGet: true,
    });

    this.messageIdCache = new Set();
    setInterval(() => this.messageIdCache.clear(), 5 * 60 * 1000);
  }

  getPermissions(groupJid: string, userJid: string): any | null {
    const key = `${groupJid}:${userJid}`;
    const cached = this.permissionsCache.get(key);

    if (cached) {
      this.stats.hits++;
      return cached;
    }

    this.stats.misses++;
    return null;
  }

  setPermissions(groupJid: string, userJid: string, perms: any): void {
    const key = `${groupJid}:${userJid}`;
    this.permissionsCache.set(key, perms);
  }

  invalidatePermissions(groupJid?: string): void {
    if (groupJid) {
      for (const key of this.permissionsCache.keys()) {
        if (key.startsWith(groupJid + ":")) {
          this.permissionsCache.delete(key);
        }
      }
    } else {
      this.permissionsCache.clear();
    }
  }

  getGroupMetadata(groupJid: string): any | null {
    const cached = this.groupMetadataCache.get(groupJid);
    if (cached) {
      this.stats.hits++;
      return cached;
    }
    this.stats.misses++;
    return null;
  }

  setGroupMetadata(groupJid: string, metadata: any): void {
    this.groupMetadataCache.set(groupJid, metadata);
  }

  invalidateGroupMetadata(groupJid: string): void {
    this.groupMetadataCache.delete(groupJid);
    this.invalidatePermissions(groupJid);
  }

  getUser(jid: string): any | null {
    const cached = this.userCache.get(jid);
    if (cached) {
      this.stats.hits++;
      return cached;
    }
    this.stats.misses++;
    return null;
  }

  setUser(jid: string, user: any): void {
    this.userCache.set(jid, user);
  }

  invalidateUser(jid: string): void {
    this.userCache.delete(jid);
  }

  hasProcessedMessage(messageId: string): boolean {
    return this.messageIdCache.has(messageId);
  }

  markMessageProcessed(messageId: string): void {
    this.messageIdCache.add(messageId);
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate:
        total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) + "%" : "0%",
      sizes: {
        permissions: this.permissionsCache.size,
        metadata: this.groupMetadataCache.size,
        users: this.userCache.size,
        messages: this.messageIdCache.size,
      },
    };
  }

  clear(): void {
    this.permissionsCache.clear();
    this.groupMetadataCache.clear();
    this.userCache.clear();
    this.messageIdCache.clear();
  }
}

export const cacheManager = new UnifiedCacheManager();
