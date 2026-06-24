import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AntiSpamMiddleware } from '../../src/middlewares/AntiSpamMiddleware.js';
import type { MessageContext } from '../../src/types/index.js';

vi.mock('../../src/services/system/Servicemanager.js', () => ({
  serviceManager: {
    groupService: {
      getGroup: vi.fn(),
    },
  },
}));

describe('AntiSpamMiddleware', () => {
  let middleware: AntiSpamMiddleware;
  let mockNext: ReturnType<typeof vi.fn>;
  let mockGetGroup: ReturnType<typeof vi.fn>;

  const defaultGroupSettings = {
    jid: 'group@test.g.us',
    name: 'Test',
    isActive: true,
    onlyAdmin: false,
    welcome: { enabled: false },
    goodbye: { enabled: false },
    antiSpam: { enabled: true, maxMessages: 5, timeWindow: 60 },
    levels: { enabled: false, announceOnLevelUp: false },
    economy: { enabled: false },
    antiLink: { enabled: false, allowedDomains: [] },
    antiWords: { enabled: false, words: [] },
    audios: false,
    nsfw: false,
    prime: { enabled: false },
    license: {
      planType: 'permanent',
      paymentType: 'single',
      activatedAt: 0,
      expiresAt: null,
      renewAt: null,
      lastRenewAt: null,
      autoRenew: false,
      pricePaid: '0',
    },
    autoMod: { enabled: false, deleteLinks: false, deleteBadWords: false, warnOnViolation: false },
    stats: { totalMessages: 0, totalCommands: 0 },
    createdAt: 0,
    updatedAt: 0,
  };

  const createGroupCtx = (isBotAdmin = false): MessageContext =>
    ({
      command: 'test',
      args: [],
      message: {} as any,
      sock: {
        sendMessage: vi.fn().mockResolvedValue(undefined),
        groupParticipantsUpdate: vi.fn().mockResolvedValue(undefined),
      } as any,
      chat: { jid: 'group@test.g.us', isGroup: true, isBotAdmin, pushName: 'TestUser' },
      sender: { jid: 'user@test.com', isOwner: false, isAdmin: false, pushName: 'TestUser' },
      reply: vi.fn().mockResolvedValue(undefined),
      react: vi.fn().mockResolvedValue(undefined),
      text: '',
    }) as unknown as MessageContext;

  const createPrivateCtx = (): MessageContext =>
    ({
      command: 'test',
      args: [],
      message: {} as any,
      sock: {} as any,
      chat: { jid: 'user@s.whatsapp.net', isGroup: false, isBotAdmin: false },
      sender: { jid: 'user@test.com', isOwner: false, isAdmin: false },
      reply: vi.fn(),
      react: vi.fn(),
      text: '',
    }) as unknown as MessageContext;

  const seedTracker = (warnings: number, msgCount: number): void => {
    const now = Date.now();
    (middleware as any).userMessages.set('group@test.g.us:user@test.com', {
      warnings,
      messages: Array.from({ length: msgCount }, (_, i) => now - i * 1000),
    });
  };

  beforeEach(async () => {
    mockNext = vi.fn().mockResolvedValue(undefined);

    const { serviceManager } = await import('../../src/services/system/Servicemanager.js');
    mockGetGroup = serviceManager.groupService.getGroup as ReturnType<typeof vi.fn>;
    mockGetGroup.mockReset();
    mockGetGroup.mockResolvedValue(defaultGroupSettings);

    middleware = new AntiSpamMiddleware();
    (middleware as any).userMessages.clear();
  });

  afterEach(() => {
    middleware.stop();
  });

  describe('private chat', () => {
    it('should skip spam check in private chat', async () => {
      const ctx = createPrivateCtx();
      await middleware.execute(ctx, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('group chat - spam detection', () => {
    it('should allow messages within limit', async () => {
      const ctx = createGroupCtx();
      await middleware.execute(ctx, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should warn on first spam violation', async () => {
      const ctx = createGroupCtx();
      seedTracker(0, 5);
      await middleware.execute(ctx, mockNext);
      expect(ctx.reply).toHaveBeenCalledWith('⚠️ *Advertencia:* No hagas spam');
    });

    it('should warn again on second spam violation', async () => {
      const ctx = createGroupCtx();
      seedTracker(1, 5);
      await middleware.execute(ctx, mockNext);
      expect(ctx.reply).toHaveBeenCalledWith(
        '⚠️ *Última advertencia:* Deja de hacer spam o serás expulsado',
      );
    });

    it('should remove user when warnings >= 3 and bot is admin', async () => {
      const ctx = createGroupCtx(true);
      const mockParticipants = ctx.sock.groupParticipantsUpdate as ReturnType<typeof vi.fn>;
      seedTracker(2, 5);
      await middleware.execute(ctx, mockNext);
      expect(mockParticipants).toHaveBeenCalledWith('group@test.g.us', ['user@test.com'], 'remove');
    });

    it('should notify if warnings >= 3 but bot is not admin', async () => {
      const ctx = createGroupCtx(false);
      seedTracker(2, 5);
      await middleware.execute(ctx, mockNext);
      expect(ctx.reply).toHaveBeenCalledWith(
        '❌ Spam detectado. Serías expulsado si el bot fuera administrador.',
      );
    });
  });

  describe('user removal (memory leak fix)', () => {
    it('should delete tracker entry after successful kick (finally block)', async () => {
      const ctx = createGroupCtx(true);
      (ctx.sock.groupParticipantsUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      seedTracker(2, 5);
      await middleware.execute(ctx, mockNext);
      expect((middleware as any).userMessages.has('group@test.g.us:user@test.com')).toBe(false);
    });

    it('should delete tracker entry even if kick fails (finally block)', async () => {
      const ctx = createGroupCtx(true);
      (ctx.sock.groupParticipantsUpdate as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('No admin'),
      );
      seedTracker(2, 5);
      await middleware.execute(ctx, mockNext);
      expect((middleware as any).userMessages.has('group@test.g.us:user@test.com')).toBe(false);
      expect(ctx.reply).toHaveBeenCalledWith('❌ No pude expulsar al usuario (falta permisos)');
    });
  });

  describe('stop() method', () => {
    it('should clear cleanup timer on stop', () => {
      expect(() => middleware.stop()).not.toThrow();
      expect(() => middleware.stop()).not.toThrow();
    });
  });
});
