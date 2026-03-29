import { LRUCache } from 'lru-cache';

export interface CooldownEntry {
  lastUsed: number;
  expiresAt: number;
}

export class CooldownService {
  private static instance: CooldownService;
  private cooldowns = new LRUCache<string, CooldownEntry>({
    max: 5000,
    ttl: 60 * 60 * 1000,
    updateAgeOnGet: false,
  });

  private constructor() {}

  static getInstance(): CooldownService {
    if (!CooldownService.instance) {
      CooldownService.instance = new CooldownService();
    }
    return CooldownService.instance;
  }

  check(
    commandName: string,
    userId: string,
    cooldownMs: number,
  ): { allowed: boolean; remainingMs: number } {
    const key = `${commandName}:${userId}`;
    const entry = this.cooldowns.get(key);

    if (!entry) {
      this.set(commandName, userId, cooldownMs);
      return { allowed: true, remainingMs: 0 };
    }

    const now = Date.now();
    if (now >= entry.expiresAt) {
      this.set(commandName, userId, cooldownMs);
      return { allowed: true, remainingMs: 0 };
    }

    return {
      allowed: false,
      remainingMs: entry.expiresAt - now,
    };
  }

  set(commandName: string, userId: string, cooldownMs: number): void {
    const key = `${commandName}:${userId}`;
    const now = Date.now();
    this.cooldowns.set(key, {
      lastUsed: now,
      expiresAt: now + cooldownMs,
    });
  }

  getRemaining(commandName: string, userId: string): number {
    const key = `${commandName}:${userId}`;
    const entry = this.cooldowns.get(key);

    if (!entry) return 0;

    const now = Date.now();
    if (now >= entry.expiresAt) return 0;

    return entry.expiresAt - now;
  }

  clear(commandName: string, userId: string): void {
    const key = `${commandName}:${userId}`;
    this.cooldowns.delete(key);
  }

  clearAll(): void {
    this.cooldowns.clear();
  }

  clearCommand(commandName: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.cooldowns.keys()) {
      if (key.startsWith(`${commandName}:`)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cooldowns.delete(key);
    }
  }

  getStats(): { size: number } {
    return { size: this.cooldowns.size };
  }
}

export const cooldownService = CooldownService.getInstance();
