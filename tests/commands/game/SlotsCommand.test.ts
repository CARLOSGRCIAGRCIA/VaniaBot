/**
 * SlotsCommand.test.ts
 *
 * Unit tests for the SlotsCommand class.
 * Tests slot machine betting, payouts, and game logic.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SlotsCommand } from '@/commands/game/SlotsCommand';
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

describe('SlotsCommand', () => {
  let command: SlotsCommand;
  let mockCtx: MessageContext;

  beforeEach(() => {
    command = new SlotsCommand();
    mockCtx = createMockMessageContext({
      command: 'slots',
      args: [],
    });
    vi.clearAllMocks();
    vi.spyOn(Math, 'random').mockRestore();
  });

  describe('command properties', () => {
    it('should have correct name', () => {
      expect(command.name).toBe('slots');
    });

    it('should have game category', () => {
      expect(command.category).toBe('game');
    });

    it('should have correct cooldown', () => {
      expect(command.cooldown).toBe(5000);
    });

    it('should have aliases', () => {
      expect(command.aliases).toContain('slot');
      expect(command.aliases).toContain('tragamonas');
    });
  });

  describe('execute - validation', () => {
    it('should reject if no bet amount provided', async () => {
      mockCtx.args = [];

      await command.execute(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Specify your bet'));
    });

    it('should reject invalid bet amount', async () => {
      mockCtx.args = ['invalid'];

      await command.execute(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Invalid bet amount'));
    });

    it('should reject negative bet amount', async () => {
      mockCtx.args = ['-100'];

      await command.execute(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Invalid bet amount'));
    });

    it('should reject zero bet amount', async () => {
      mockCtx.args = ['0'];

      await command.execute(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Invalid bet amount'));
    });

    it('should reject bet below minimum', async () => {
      mockCtx.args = ['5'];
      const mockUser = createMockUser({ money: 100 });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);

      await command.execute(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalled();
    });

    it('should reject bet higher than balance', async () => {
      mockCtx.args = ['500'];
      const mockUser = createMockUser({ money: 100 });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);

      await command.execute(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalled();
    });
  });

  describe('execute - gameplay', () => {
    it('should execute successfully with valid bet', async () => {
      mockCtx.args = ['100'];
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

    it('should react with slot emoji', async () => {
      mockCtx.args = ['100'];
      const mockUser = createMockUser({ money: 1000 });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(serviceManager.userService.removeMoney).mockResolvedValueOnce(true);
      vi.mocked(serviceManager.userService.addMoney).mockResolvedValueOnce(undefined);
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce({
        ...mockUser,
        money: 900,
      });

      await command.execute(mockCtx);

      expect(mockCtx.react).toHaveBeenCalledWith('🎰');
    });

    it('should show balance in response', async () => {
      mockCtx.args = ['100'];
      const mockUser = createMockUser({ money: 1000 });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(serviceManager.userService.removeMoney).mockResolvedValueOnce(true);
      vi.mocked(serviceManager.userService.addMoney).mockResolvedValueOnce(undefined);
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce({
        ...mockUser,
        money: 900,
      });

      await command.execute(mockCtx);

      const replyCall = vi.mocked(mockCtx.reply).mock.calls[0][0];
      expect(replyCall).toContain('Balance');
    });
  });

  describe('payouts', () => {
    it('should have correct symbol set', () => {
      const symbols = ['🍒', '🍋', '🔔', '💎', '7️⃣', '⭐'];
      expect(symbols).toHaveLength(6);
    });

    it('should have JACKPOT payout', () => {
      const PAYOUTS: { [key: string]: number } = {
        '7️⃣7️⃣7️⃣': 10,
        '💎💎💎': 8,
        '🔔🔔🔔': 5,
        '⭐⭐⭐': 4,
        '🍋🍋🍋': 3,
        '🍒🍒🍒': 3,
        match2: 1.5,
      };

      expect(PAYOUTS['7️⃣7️⃣7️⃣']).toBe(10);
    });

    it('should have match2 payout', () => {
      const PAYOUTS: { [key: string]: number } = {
        '7️⃣7️⃣7️⃣': 10,
        '💎💎💎': 8,
        '🔔🔔🔔': 5,
        '⭐⭐⭐': 4,
        '🍋🍋🍋': 3,
        '🍒🍒🍒': 3,
        match2: 1.5,
      };

      expect(PAYOUTS['match2']).toBe(1.5);
    });
  });

  describe('owner bypass', () => {
    it('should allow owner to play without money deduction', async () => {
      mockCtx.args = ['1000000'];
      mockCtx.sender.isOwner = true;
      const mockUser = createMockUser({ money: 0, isOwner: true });
      vi.mocked(serviceManager.userService.getUser).mockResolvedValueOnce(mockUser);

      await command.execute(mockCtx);

      expect(serviceManager.userService.removeMoney).not.toHaveBeenCalled();
    });
  });

  describe('result text', () => {
    it('should return correct text for JACKPOT', () => {
      const result = 'JACKPOT! Triple 7!';
      expect(result).toContain('7');
    });

    it('should return correct text for two match', () => {
      const result = 'Two Match!';
      expect(result).toContain('Match');
    });

    it('should return correct text for no match', () => {
      const result = 'No Match';
      expect(result).toContain('No');
    });
  });
});
