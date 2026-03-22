/**
 * RateLimitService.ts
 *
 * Global rate limiting service for group messages and flood protection.
 * Tracks message rates per group and user, with configurable whitelist.
 * Includes Token Bucket algorithm and state persistence.
 *
 * @author **Carlos G** ⭐
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  waitTime?: number;
  remaining?: number;
}

interface GroupTracker {
  messages: number[];
  warnings: number;
  blockedUntil?: number;
}

interface UserTracker {
  messages: number[];
  lastWarningTime: number;
  tokens: number;
  lastRefill: number;
}

interface PersistentState {
  groups: Record<string, GroupTracker>;
  users: Record<string, UserTracker>;
  lastSave: number;
}

export class RateLimitService {
  private groupTrackers = new Map<string, GroupTracker>();
  private userTrackers = new Map<string, UserTracker>();
  private readonly config = config.rateLimit;
  private readonly statePath = './data/ratelimit_state.json';
  private saveTimer: NodeJS.Timeout | null = null;

  private readonly TOKENS_PER_SECOND = 3;
  private readonly MAX_TOKENS = 10;
  private readonly TOKEN_REFILL_MS = 1000;

  constructor() {
    this.loadState();
    this.startCleanup();
    this.startAutoSave();
    logger.info('[RateLimit] Service initialized');
  }

  private loadState(): void {
    try {
      if (existsSync(this.statePath)) {
        const data = readFileSync(this.statePath, 'utf-8');
        const state: PersistentState = JSON.parse(data);
        const now = Date.now();
        const staleThreshold = 30 * 60 * 1000;

        if (state.groups) {
          for (const [jid, tracker] of Object.entries(state.groups)) {
            if (tracker.blockedUntil && tracker.blockedUntil > now) {
              this.groupTrackers.set(jid, tracker);
            } else if (tracker.warnings > 0 && !tracker.blockedUntil) {
              const lastMsg = tracker.messages[tracker.messages.length - 1];
              if (lastMsg && now - lastMsg < staleThreshold) {
                this.groupTrackers.set(jid, tracker);
              }
            }
          }
        }

        if (state.users) {
          for (const [jid, tracker] of Object.entries(state.users)) {
            const lastMsg = tracker.messages[tracker.messages.length - 1];
            if (lastMsg && now - lastMsg < staleThreshold) {
              this.userTrackers.set(jid, tracker);
            }
          }
        }

        logger.info(
          `[RateLimit] Loaded state: ${this.groupTrackers.size} groups, ${this.userTrackers.size} users`,
        );
      }
    } catch (error) {
      logger.error('[RateLimit] Failed to load state:', error);
    }
  }

  private saveState(): void {
    try {
      const dir = './data';
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const state: PersistentState = {
        groups: Object.fromEntries(this.groupTrackers),
        users: Object.fromEntries(this.userTrackers),
        lastSave: Date.now(),
      };

      writeFileSync(this.statePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) {
      logger.error('[RateLimit] Failed to save state:', error);
    }
  }

  private startAutoSave(): void {
    this.saveTimer = setInterval(() => {
      if (this.groupTrackers.size > 0 || this.userTrackers.size > 0) {
        this.saveState();
      }
    }, 30 * 1000);
  }

  checkGroupRateLimit(groupJid: string): RateLimitResult {
    if (this.isGroupWhitelisted(groupJid)) {
      return { allowed: true, remaining: Infinity };
    }

    const now = Date.now();
    const windowMs = this.config.windowMs;
    const maxMessages = this.config.maxMessagesPerGroup;

    let tracker = this.groupTrackers.get(groupJid);
    if (!tracker) {
      tracker = { messages: [], warnings: 0 };
      this.groupTrackers.set(groupJid, tracker);
    }

    if (tracker.blockedUntil && tracker.blockedUntil > now) {
      return {
        allowed: false,
        reason: '⛔ Grupo bloqueado temporalmente por spam',
        waitTime: tracker.blockedUntil - now,
      };
    }

    tracker.messages = tracker.messages.filter(time => now - time < windowMs);
    tracker.messages.push(now);

    const remaining = Math.max(0, maxMessages - tracker.messages.length);

    if (tracker.messages.length > maxMessages) {
      tracker.warnings++;

      if (tracker.warnings === 1) {
        return {
          allowed: false,
          reason: '⚠️ El grupo está enviando muchos mensajes. Reduce la velocidad.',
          waitTime: windowMs,
          remaining: 0,
        };
      }

      if (tracker.warnings >= 3) {
        tracker.blockedUntil = now + windowMs * 2;
        return {
          allowed: false,
          reason: '⛔ Grupo bloqueado temporalmente por spam',
          waitTime: windowMs * 2,
          remaining: 0,
        };
      }

      return {
        allowed: false,
        reason: '⚠️ Demasiados mensajes del grupo',
        waitTime: Math.ceil(windowMs / 2),
        remaining: 0,
      };
    }

    return { allowed: true, remaining };
  }

  checkFlood(userJid: string): RateLimitResult {
    if (this.isUserWhitelisted(userJid)) {
      return { allowed: true, remaining: Infinity };
    }

    const now = Date.now();
    const windowMs = this.config.floodWindowMs;

    let tracker = this.userTrackers.get(userJid);
    if (!tracker) {
      tracker = {
        messages: [],
        lastWarningTime: 0,
        tokens: this.MAX_TOKENS,
        lastRefill: now,
      };
      this.userTrackers.set(userJid, tracker);
    }

    const elapsed = now - tracker.lastRefill;
    if (elapsed >= this.TOKEN_REFILL_MS) {
      const tokensToAdd = Math.floor(elapsed / this.TOKEN_REFILL_MS) * this.TOKENS_PER_SECOND;
      tracker.tokens = Math.min(this.MAX_TOKENS, tracker.tokens + tokensToAdd);
      tracker.lastRefill = now;
    }

    tracker.messages = tracker.messages.filter(time => now - time < windowMs);

    if (tracker.tokens <= 0) {
      if (now - tracker.lastWarningTime > 5000) {
        tracker.lastWarningTime = now;
        return {
          allowed: false,
          reason: '⚠️ Estás escribiendo muy rápido. Espera un momento.',
          waitTime: Math.ceil((this.MAX_TOKENS / this.TOKENS_PER_SECOND) * 1000),
          remaining: 0,
        };
      }
      return { allowed: false, remaining: 0 };
    }

    tracker.tokens--;
    tracker.messages.push(now);
    return { allowed: true, remaining: tracker.tokens };
  }

  isGroupWhitelisted(groupJid: string): boolean {
    return this.config.whitelistGroups.some(whitelisted => groupJid.includes(whitelisted));
  }

  isUserWhitelisted(userJid: string): boolean {
    return this.config.whitelistUsers.some(whitelisted => userJid.includes(whitelisted));
  }

  addGroupToWhitelist(groupJid: string): void {
    if (!this.isGroupWhitelisted(groupJid)) {
      this.config.whitelistGroups.push(groupJid);
      this.groupTrackers.delete(groupJid);
      logger.info(`[RateLimit] Group ${groupJid} added to whitelist`);
    }
  }

  removeGroupFromWhitelist(groupJid: string): void {
    const index = this.config.whitelistGroups.findIndex(g => groupJid.includes(g));
    if (index !== -1) {
      this.config.whitelistGroups.splice(index, 1);
      logger.info(`[RateLimit] Group ${groupJid} removed from whitelist`);
    }
  }

  addUserToWhitelist(userJid: string): void {
    if (!this.isUserWhitelisted(userJid)) {
      this.config.whitelistUsers.push(userJid);
      this.userTrackers.delete(userJid);
      logger.info(`[RateLimit] User ${userJid} added to whitelist`);
    }
  }

  removeUserFromWhitelist(userJid: string): void {
    const index = this.config.whitelistUsers.findIndex(u => userJid.includes(u));
    if (index !== -1) {
      this.config.whitelistUsers.splice(index, 1);
      logger.info(`[RateLimit] User ${userJid} removed from whitelist`);
    }
  }

  getGroupStats(groupJid: string): { messageCount: number; warnings: number; blocked: boolean } {
    const tracker = this.groupTrackers.get(groupJid);
    if (!tracker) {
      return { messageCount: 0, warnings: 0, blocked: false };
    }

    const now = Date.now();
    const recentMessages = tracker.messages.filter(time => now - time < this.config.windowMs);

    return {
      messageCount: recentMessages.length,
      warnings: tracker.warnings,
      blocked: tracker.blockedUntil ? tracker.blockedUntil > now : false,
    };
  }

  getStats(): {
    trackedGroups: number;
    trackedUsers: number;
    whitelistGroups: number;
    whitelistUsers: number;
  } {
    return {
      trackedGroups: this.groupTrackers.size,
      trackedUsers: this.userTrackers.size,
      whitelistGroups: this.config.whitelistGroups.length,
      whitelistUsers: this.config.whitelistUsers.length,
    };
  }

  resetGroup(groupJid: string): void {
    this.groupTrackers.delete(groupJid);
    this.saveState();
    logger.info(`[RateLimit] Group ${groupJid} stats reset`);
  }

  resetUser(userJid: string): void {
    this.userTrackers.delete(userJid);
    this.saveState();
    logger.info(`[RateLimit] User ${userJid} stats reset`);
  }

  shutdown(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
    }
    this.saveState();
  }

  private startCleanup(): void {
    setInterval(() => {
      try {
        const now = Date.now();
        const maxAge = 5 * 60 * 1000;

        for (const [groupJid, tracker] of this.groupTrackers.entries()) {
          if (tracker.blockedUntil && tracker.blockedUntil <= now) {
            tracker.blockedUntil = undefined;
          }

          tracker.messages = tracker.messages.filter(time => now - time < maxAge);

          if (tracker.messages.length === 0 && tracker.warnings === 0 && !tracker.blockedUntil) {
            this.groupTrackers.delete(groupJid);
          }
        }

        for (const [userJid, tracker] of this.userTrackers.entries()) {
          tracker.messages = tracker.messages.filter(time => now - time < maxAge);
          if (tracker.messages.length === 0) {
            this.userTrackers.delete(userJid);
          }
        }
      } catch (error) {
        logger.error('[RateLimit] Cleanup error:', error);
      }
    }, 60 * 1000);
  }
}

export const rateLimitService = new RateLimitService();
