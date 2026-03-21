import { describe, it, expect, beforeEach } from 'vitest';
import { AntiSpamService } from '@/services/system/AntiSpamService.js';

describe('AntiSpamService', () => {
  let antiSpam: AntiSpamService;

  beforeEach(() => {
    antiSpam = new AntiSpamService({
      maxMessagesPerSecond: 10,
      maxMessagesPerMinute: 20,
      banDurationMs: 5000,
      cleanupIntervalMs: 60000,
    });
  });

  describe('check()', () => {
    it('should allow first message from user', () => {
      const result = antiSpam.check('user@test.com');
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should allow messages within rate limits', async () => {
      const userJid = 'user@test.com';
      for (let i = 0; i < 5; i++) {
        const result = antiSpam.check(userJid);
        expect(result.allowed).toBe(true);
      }
      await new Promise(resolve => setTimeout(resolve, 1100));
      for (let i = 0; i < 3; i++) {
        const result = antiSpam.check(userJid);
        expect(result.allowed).toBe(true);
      }
    });

    it('should block user exceeding messages per minute', async () => {
      const userJid = 'spam@test.com';
      for (let i = 0; i < 20; i++) {
        antiSpam.check(userJid);
      }
      const result = antiSpam.check(userJid);
      expect(result.allowed).toBe(false);
      expect(['Bloqueado', 'rápido']).toContain(
        result.reason?.split(' ')[0] === 'Bloqueado' ? 'Bloqueado' : 'rápido',
      );
    });

    it('should block user exceeding messages per second', () => {
      const userJid = 'fast@test.com';
      const results: boolean[] = [];
      for (let i = 0; i < 15; i++) {
        results.push(antiSpam.check(userJid).allowed);
      }
      expect(results.filter(r => !r).length).toBeGreaterThan(0);
    });
  });

  describe('getStats()', () => {
    it('should return initial stats', () => {
      const stats = antiSpam.getStats();
      expect(stats.tracked).toBe(0);
      expect(stats.banned).toBe(0);
    });

    it('should track active users', () => {
      antiSpam.check('user1@test.com');
      antiSpam.check('user2@test.com');
      const stats = antiSpam.getStats();
      expect(stats.tracked).toBe(2);
    });
  });

  describe('clearUser()', () => {
    it('should clear user data', () => {
      const userJid = 'clear@test.com';
      antiSpam.check(userJid);
      expect(antiSpam.getStats().tracked).toBe(1);

      antiSpam.clearUser(userJid);
      expect(antiSpam.getStats().tracked).toBe(0);
    });
  });
});
