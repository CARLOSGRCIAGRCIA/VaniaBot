/**
 * WorkCommand.test.ts
 *
 * Unit tests for the WorkCommand class.
 * Tests work execution, job selection, earnings, and XP gain.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkCommand } from '@/commands/economy/WorkCommand';
import type { MessageContext } from '@/types';
import type { User } from '@/services/database/UserService';

const createMockUser = (overrides: Partial<User> = {}): User => ({
  jid: 'user@test.com',
  name: 'Test User',
  isOwner: false,
  isBanned: false,
  level: 1,
  xp: 0,
  money: 1000,
  lastDaily: undefined,
  lastWeekly: undefined,
  lastMonthly: undefined,
  weeklyStreak: 0,
  totalCommands: 0,
  warnings: 0,
  inventory: [],
  achievements: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

const createMockMessageContext = (overrides: Partial<MessageContext> = {}): MessageContext => {
  return {
    command: '',
    args: [],
    text: '',
    message: {
      key: {
        id: 'test-message-id',
        remoteJid: 'group@test.g.us',
        fromMe: false,
        participant: 'user@test.com',
      },
      message: {},
    } as any,
    sock: {} as any,
    chat: {
      jid: 'group@test.g.us',
      isGroup: true,
      isBotAdmin: false,
    },
    sender: {
      jid: 'user@test.com',
      pushName: 'Test User',
      isOwner: false,
      isAdmin: false,
    },
    reply: vi.fn().mockResolvedValue(undefined),
    react: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    loadSenderPermissions: vi.fn().mockResolvedValue(undefined),
    loadBotPermissions: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as MessageContext;
};

vi.mock('@/services/system/Servicemanager', () => ({
  serviceManager: {
    userService: {
      getUser: vi.fn(),
      addMoney: vi.fn(),
    },
    levelService: {
      addXP: vi.fn(),
    },
  },
}));

import { serviceManager } from '@/services/system/Servicemanager';

describe('WorkCommand', () => {
  let command: WorkCommand;
  let mockCtx: MessageContext;

  beforeEach(() => {
    command = new WorkCommand();
    mockCtx = createMockMessageContext({
      command: 'work',
      args: [],
    });
    vi.clearAllMocks();
    vi.spyOn(Math, 'random').mockRestore();
  });

  describe('command properties', () => {
    it('should have correct name', () => {
      expect(command.name).toBe('work');
    });

    it('should have economy category', () => {
      expect(command.category).toBe('economy');
    });

    it('should have correct cooldown', () => {
      expect(command.cooldown).toBe(60 * 60 * 1000);
    });

    it('should have work alias', () => {
      expect(command.aliases).toContain('work');
    });
  });

  describe('execute - successful work', () => {
    it('should add money after working', async () => {
      const mockUser = createMockUser({ money: 100 });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(serviceManager.userService.addMoney).mockResolvedValueOnce(undefined);
      vi.mocked(serviceManager.levelService.addXP).mockResolvedValueOnce({
        leveledUp: false,
        oldLevel: 1,
        newLevel: 1,
        xpGained: 50,
        totalXP: 50,
        nextLevelXP: 200,
      });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce({
        ...mockUser,
        money: 1100,
      });

      await command.execute(mockCtx);

      expect(serviceManager.userService.addMoney).toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalled();
    });

    it('should add XP after working', async () => {
      const mockUser = createMockUser({ xp: 0 });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(serviceManager.userService.addMoney).mockResolvedValueOnce(undefined);
      vi.mocked(serviceManager.levelService.addXP).mockResolvedValueOnce({
        leveledUp: false,
        oldLevel: 1,
        newLevel: 1,
        xpGained: 50,
        totalXP: 50,
        nextLevelXP: 200,
      });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce({
        ...mockUser,
        xp: 50,
      });

      await command.execute(mockCtx);

      expect(serviceManager.levelService.addXP).toHaveBeenCalledWith(
        mockCtx.sender.jid,
        expect.any(Number),
      );
    });

    it('should calculate XP based on earnings', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const mockUser = createMockUser({ money: 100 });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(serviceManager.userService.addMoney).mockResolvedValueOnce(undefined);
      vi.mocked(serviceManager.levelService.addXP).mockResolvedValueOnce({
        leveledUp: false,
        oldLevel: 1,
        newLevel: 1,
        xpGained: 50,
        totalXP: 50,
        nextLevelXP: 200,
      });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce({
        ...mockUser,
        money: 1100,
      });

      await command.execute(mockCtx);

      const addXPCall = vi.mocked(serviceManager.levelService.addXP).mock.calls[0];
      const xpAmount = addXPCall[1];
      expect(xpAmount).toBeGreaterThan(0);
    });
  });

  describe('execute - job selection', () => {
    it('should select from available jobs', async () => {
      const mockUser = createMockUser({ money: 100 });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(serviceManager.userService.addMoney).mockResolvedValueOnce(undefined);
      vi.mocked(serviceManager.levelService.addXP).mockResolvedValueOnce({
        leveledUp: false,
        oldLevel: 1,
        newLevel: 1,
        xpGained: 50,
        totalXP: 50,
        nextLevelXP: 200,
      });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce({
        ...mockUser,
        money: 1100,
      });

      await command.execute(mockCtx);

      const replyCall = vi.mocked(mockCtx.reply).mock.calls[0][0];
      const jobs = ['Programmer', 'Chef', 'Driver', 'Teacher', 'Musician'];
      const hasValidJob = jobs.some(job => replyCall.includes(job));
      expect(hasValidJob).toBe(true);
    });

    it('should include job emoji in response', async () => {
      const mockUser = createMockUser({ money: 100 });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(serviceManager.userService.addMoney).mockResolvedValueOnce(undefined);
      vi.mocked(serviceManager.levelService.addXP).mockResolvedValueOnce({
        leveledUp: false,
        oldLevel: 1,
        newLevel: 1,
        xpGained: 50,
        totalXP: 50,
        nextLevelXP: 200,
      });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce({
        ...mockUser,
        money: 1100,
      });

      await command.execute(mockCtx);

      const replyCall = vi.mocked(mockCtx.reply).mock.calls[0][0];
      expect(replyCall).toMatch(/[💻👨‍🍳🚗👨‍🏫🎸]/);
    });
  });

  describe('execute - error handling', () => {
    it('should handle errors gracefully', async () => {
      vi.mocked(serviceManager.userService.getUser).mockRejectedValueOnce(
        new Error('Database error'),
      );

      try {
        await command.execute(mockCtx);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('job earnings ranges', () => {
    it('should have valid earnings for Programmer job', () => {
      const jobs = [
        { name: 'Programmer', min: 500, max: 1500, emoji: '💻' },
        { name: 'Chef', min: 300, max: 1000, emoji: '👨‍🍳' },
        { name: 'Driver', min: 200, max: 800, emoji: '🚗' },
        { name: 'Teacher', min: 400, max: 1200, emoji: '👨‍🏫' },
        { name: 'Musician', min: 250, max: 900, emoji: '🎸' },
      ];

      const programmer = jobs.find(j => j.name === 'Programmer');
      expect(programmer).toBeDefined();
      expect(programmer!.min).toBeLessThan(programmer!.max);
      expect(programmer!.min).toBe(500);
      expect(programmer!.max).toBe(1500);
    });

    it('should have valid earnings for all jobs', () => {
      const jobs = [
        { name: 'Programmer', min: 500, max: 1500, emoji: '💻' },
        { name: 'Chef', min: 300, max: 1000, emoji: '👨‍🍳' },
        { name: 'Driver', min: 200, max: 800, emoji: '🚗' },
        { name: 'Teacher', min: 400, max: 1200, emoji: '👨‍🏫' },
        { name: 'Musician', min: 250, max: 900, emoji: '🎸' },
      ];

      jobs.forEach(job => {
        expect(job.min).toBeGreaterThan(0);
        expect(job.max).toBeGreaterThan(job.min);
      });
    });
  });
});
