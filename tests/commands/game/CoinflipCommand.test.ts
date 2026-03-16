/**
 * CoinflipCommand.test.ts
 *
 * Unit tests for the CoinflipCommand class.
 * Tests coin flip betting, win/loss logic, and result display.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CoinflipCommand } from '@/commands/game/CoinflipCommand';
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
      removeMoney: vi.fn(),
    },
  },
}));

vi.mock('@/config/index', () => ({
  config: {
    economy: {
      minBet: 10,
      maxBet: 10000,
      minTransfer: 1,
      maxTransfer: 1000000,
    },
  },
}));

import { serviceManager } from '@/services/system/Servicemanager';
import { config } from '@/config/index';

describe('CoinflipCommand', () => {
  let command: CoinflipCommand;
  let mockCtx: MessageContext;

  beforeEach(() => {
    command = new CoinflipCommand();
    mockCtx = createMockMessageContext({
      command: 'coinflip',
      args: [],
    });
    vi.clearAllMocks();
    vi.spyOn(Math, 'random').mockRestore();
  });

  describe('command properties', () => {
    it('should have correct name', () => {
      expect(command.name).toBe('coinflip');
    });

    it('should have game category', () => {
      expect(command.category).toBe('game');
    });

    it('should have correct cooldown', () => {
      expect(command.cooldown).toBe(5000);
    });

    it('should have cf alias', () => {
      expect(command.aliases).toContain('cf');
    });
  });

  describe('execute - validation', () => {
    it('should reject if no choice provided', async () => {
      mockCtx.args = [];

      await command.execute(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Invalid choice'));
    });

    it('should reject invalid choice', async () => {
      mockCtx.args = ['invalid', '100'];

      await command.execute(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Invalid choice'));
    });

    it('should accept heads choice', async () => {
      mockCtx.args = ['heads', '100'];
      const mockUser = createMockUser({ money: 1000 });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(serviceManager.userService.removeMoney).mockResolvedValueOnce(true);
      vi.mocked(serviceManager.userService.addMoney).mockResolvedValueOnce(undefined);
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce({
        ...mockUser,
        money: 900,
      });

      await command.execute(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalled();
    });

    it('should accept tails choice', async () => {
      mockCtx.args = ['tails', '100'];
      const mockUser = createMockUser({ money: 1000 });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(serviceManager.userService.removeMoney).mockResolvedValueOnce(true);
      vi.mocked(serviceManager.userService.addMoney).mockResolvedValueOnce(undefined);
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce({
        ...mockUser,
        money: 900,
      });

      await command.execute(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalled();
    });

    it('should accept short alias h for heads', async () => {
      mockCtx.args = ['h', '100'];
      const mockUser = createMockUser({ money: 1000 });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(serviceManager.userService.removeMoney).mockResolvedValueOnce(true);
      vi.mocked(serviceManager.userService.addMoney).mockResolvedValueOnce(undefined);
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce({
        ...mockUser,
        money: 900,
      });

      await command.execute(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalled();
    });

    it('should accept short alias t for tails', async () => {
      mockCtx.args = ['t', '100'];
      const mockUser = createMockUser({ money: 1000 });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(serviceManager.userService.removeMoney).mockResolvedValueOnce(true);
      vi.mocked(serviceManager.userService.addMoney).mockResolvedValueOnce(undefined);
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce({
        ...mockUser,
        money: 900,
      });

      await command.execute(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalled();
    });

    it('should reject invalid amount', async () => {
      mockCtx.args = ['heads', 'invalid'];

      await command.execute(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Invalid amount'));
    });

    it('should reject negative amount', async () => {
      mockCtx.args = ['heads', '-100'];

      await command.execute(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Invalid amount'));
    });

    it('should reject zero amount', async () => {
      mockCtx.args = ['heads', '0'];

      await command.execute(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Invalid amount'));
    });

    it('should reject if insufficient funds', async () => {
      mockCtx.args = ['heads', '2000'];
      const mockUser = createMockUser({ money: 1000 });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);

      await command.execute(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalled();
    });
  });

  describe('execute - win scenario', () => {
    it('should add money on win', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.3);
      mockCtx.args = ['heads', '100'];
      const mockUser = createMockUser({ money: 1000 });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(serviceManager.userService.removeMoney).mockResolvedValueOnce(true);
      vi.mocked(serviceManager.userService.addMoney).mockResolvedValueOnce(undefined);
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce({
        ...mockUser,
        money: 1100,
      });

      await command.execute(mockCtx);

      expect(serviceManager.userService.addMoney).toHaveBeenCalledWith(mockCtx.sender.jid, 100);
    });

    it('should show win message', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.3);
      mockCtx.args = ['heads', '100'];
      const mockUser = createMockUser({ money: 1000 });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(serviceManager.userService.removeMoney).mockResolvedValueOnce(true);
      vi.mocked(serviceManager.userService.addMoney).mockResolvedValueOnce(undefined);
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce({
        ...mockUser,
        money: 1100,
      });

      await command.execute(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('YOU WON'));
    });
  });

  describe('execute - loss scenario', () => {
    it('should remove money on loss', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.7);
      mockCtx.args = ['heads', '100'];
      const mockUser = createMockUser({ money: 1000 });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(serviceManager.userService.removeMoney).mockResolvedValueOnce(true);
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce({
        ...mockUser,
        money: 900,
      });

      await command.execute(mockCtx);

      expect(serviceManager.userService.removeMoney).toHaveBeenCalledWith(mockCtx.sender.jid, 100);
    });

    it('should show loss message', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.7);
      mockCtx.args = ['heads', '100'];
      const mockUser = createMockUser({ money: 1000 });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(serviceManager.userService.removeMoney).mockResolvedValueOnce(true);
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce({
        ...mockUser,
        money: 900,
      });

      await command.execute(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('lost'));
    });
  });

  describe('result display', () => {
    it('should show choice in result', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      mockCtx.args = ['heads', '100'];
      const mockUser = createMockUser({ money: 1000 });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(serviceManager.userService.removeMoney).mockResolvedValueOnce(true);
      vi.mocked(serviceManager.userService.addMoney).mockResolvedValueOnce(undefined);
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce({
        ...mockUser,
        money: 1000,
      });

      await command.execute(mockCtx);

      const replyCall = vi.mocked(mockCtx.reply).mock.calls[0][0];
      expect(replyCall).toContain('HEADS');
    });

    it('should show balance in result', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      mockCtx.args = ['heads', '100'];
      const mockUser = createMockUser({ money: 1000 });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(serviceManager.userService.removeMoney).mockResolvedValueOnce(true);
      vi.mocked(serviceManager.userService.addMoney).mockResolvedValueOnce(undefined);
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce({
        ...mockUser,
        money: 1000,
      });

      await command.execute(mockCtx);

      const replyCall = vi.mocked(mockCtx.reply).mock.calls[0][0];
      expect(replyCall).toContain('Balance');
    });
  });
});
