/**
 * DailyCommand.test.ts
 *
 * Unit tests for the DailyCommand class.
 * Tests daily reward claiming, streak calculation, and reward distribution.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DailyCommand } from '@/commands/economy/DailyCommand';
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
  const mockReply = vi.fn().mockResolvedValue(undefined);
  const mockReact = vi.fn().mockResolvedValue(undefined);

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
    reply: mockReply,
    react: mockReact,
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
      updateUser: vi.fn(),
    },
    levelService: {
      addXP: vi.fn(),
    },
  },
}));

import { serviceManager } from '@/services/system/Servicemanager';

describe('DailyCommand', () => {
  let command: DailyCommand;
  let mockCtx: MessageContext;

  beforeEach(() => {
    command = new DailyCommand();
    mockCtx = createMockMessageContext({
      command: 'daily',
      args: [],
    });
    vi.clearAllMocks();
  });

  describe('command properties', () => {
    it('should have correct name', () => {
      expect(command.name).toBe('daily');
    });

    it('should have economy category', () => {
      expect(command.category).toBe('economy');
    });

    it('should have correct cooldown', () => {
      expect(command.cooldown).toBe(1000);
    });

    it('should have daily alias', () => {
      expect(command.aliases).toContain('daily');
    });
  });

  describe('execute - successful claim', () => {
    it('should claim daily reward for new user with base reward', async () => {
      const mockUser = createMockUser({ lastDaily: undefined, money: 0 });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(serviceManager.userService.addMoney).mockResolvedValueOnce(undefined);
      vi.mocked(serviceManager.userService.updateUser).mockResolvedValueOnce(undefined);
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
        lastDaily: Date.now(),
      });

      await command.execute(mockCtx);

      expect(serviceManager.userService.addMoney).toHaveBeenCalledWith(mockCtx.sender.jid, 1100);
      expect(serviceManager.levelService.addXP).toHaveBeenCalledWith(mockCtx.sender.jid, 50);
      expect(mockCtx.reply).toHaveBeenCalled();
    });

    it('should calculate streak bonus correctly when claimed yesterday', async () => {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const mockUser = createMockUser({
        lastDaily: oneDayAgo,
        money: 0,
      });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(serviceManager.userService.addMoney).mockResolvedValueOnce(undefined);
      vi.mocked(serviceManager.userService.updateUser).mockResolvedValueOnce(undefined);
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
        money: 1200,
        lastDaily: Date.now(),
      });

      await command.execute(mockCtx);

      const addMoneyCall = vi.mocked(serviceManager.userService.addMoney).mock.calls[0];
      expect(addMoneyCall[1]).toBe(1200);
    });

    it('should reset streak if more than 2 days passed', async () => {
      const oldClaim = Date.now() - 3 * 24 * 60 * 60 * 1000;
      const mockUser = createMockUser({ lastDaily: oldClaim, money: 0 });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(serviceManager.userService.addMoney).mockResolvedValueOnce(undefined);
      vi.mocked(serviceManager.userService.updateUser).mockResolvedValueOnce(undefined);
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
        lastDaily: Date.now(),
      });

      await command.execute(mockCtx);

      const addMoneyCall = vi.mocked(serviceManager.userService.addMoney).mock.calls[0];
      expect(addMoneyCall[1]).toBe(1100);
    });
  });

  describe('execute - cooldown', () => {
    it('should not allow claim if daily already claimed', async () => {
      const recentClaim = Date.now() - 6 * 60 * 60 * 1000;
      const mockUser = createMockUser({ lastDaily: recentClaim });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);

      await command.execute(mockCtx);

      expect(serviceManager.userService.addMoney).not.toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('already claimed'));
    });

    it('should show time remaining when on cooldown', async () => {
      const recentClaim = Date.now() - 12 * 60 * 60 * 1000;
      const mockUser = createMockUser({ lastDaily: recentClaim });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);

      await command.execute(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Available again in:'));
    });
  });

  describe('execute - streak calculation', () => {
    it('should reset streak if more than 2 days passed', async () => {
      const oldClaim = Date.now() - 3 * 24 * 60 * 60 * 1000;
      const mockUser = createMockUser({ lastDaily: oldClaim, weeklyStreak: 10 });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(serviceManager.userService.addMoney).mockResolvedValueOnce(undefined);
      vi.mocked(serviceManager.userService.updateUser).mockResolvedValueOnce(undefined);
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
        lastDaily: Date.now(),
      });

      await command.execute(mockCtx);

      const updateCall = vi.mocked(serviceManager.userService.updateUser).mock.calls[0];
      expect(updateCall[1]).toHaveProperty('lastDaily');
    });

    it('should give streak bonus when claimed yesterday', async () => {
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      const mockUser = createMockUser({
        lastDaily: yesterday,
        money: 0,
      });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(serviceManager.userService.addMoney).mockResolvedValueOnce(undefined);
      vi.mocked(serviceManager.userService.updateUser).mockResolvedValueOnce(undefined);
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
        money: 1200,
        lastDaily: Date.now(),
      });

      await command.execute(mockCtx);

      expect(serviceManager.userService.addMoney).toHaveBeenCalledWith(mockCtx.sender.jid, 1200);
    });
  });

  describe('execute - error handling', () => {
    it('should handle missing user gracefully', async () => {
      vi.mocked(serviceManager.userService.getUser).mockRejectedValueOnce(
        new Error('User not found'),
      );

      await command.execute(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalled();
    });
  });
});
