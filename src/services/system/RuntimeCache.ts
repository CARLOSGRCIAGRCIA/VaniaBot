/**
 * RuntimeCache.ts
 *
 * Cache layer pararuntime state.
 * Usa Redis en Docker, SQLite en local.
 *
 * @author Carlos G
 * @created 2026-04-11
 */

import { databaseSwitcher } from './DatabaseSwitcher.js';

export class RuntimeCache {
  private static instance: RuntimeCache;
  private prefix = 'vania:runtime:';

  private constructor() {}

  static getInstance(): RuntimeCache {
    if (!RuntimeCache.instance) {
      RuntimeCache.instance = new RuntimeCache();
    }
    return RuntimeCache.instance;
  }

  async get(key: string): Promise<string | null> {
    const redis = databaseSwitcher.getRedisClient();
    if (redis && databaseSwitcher.isUsingRedis()) {
      return redis.get(`${this.prefix}${key}`);
    }
    return null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const redis = databaseSwitcher.getRedisClient();
    if (redis && databaseSwitcher.isUsingRedis()) {
      if (ttlSeconds) {
        await redis.setEx(`${this.prefix}${key}`, ttlSeconds, value);
      } else {
        await redis.set(`${this.prefix}${key}`, value);
      }
    }
  }

  async del(key: string): Promise<void> {
    const redis = databaseSwitcher.getRedisClient();
    if (redis && databaseSwitcher.isUsingRedis()) {
      await redis.del(`${this.prefix}${key}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    const redis = databaseSwitcher.getRedisClient();
    if (redis && databaseSwitcher.isUsingRedis()) {
      return (await redis.exists(`${this.prefix}${key}`)) === 1;
    }
    return false;
  }

  async getBotState(botId: string): Promise<any | null> {
    const json = await this.get(`bot:${botId}`);
    if (json) {
      try {
        return JSON.parse(json);
      } catch {
        return null;
      }
    }
    return null;
  }

  async setBotState(botId: string, state: any): Promise<void> {
    await this.set(`bot:${botId}`, JSON.stringify(state), 3600);
  }
}

export const runtimeCache = RuntimeCache.getInstance();
