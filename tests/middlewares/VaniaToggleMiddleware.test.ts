/**
 * VaniaToggleMiddleware.test.ts
 *
 * Unit tests for the VaniaToggleMiddleware class.
 * Tests the toggle bypass security fix (vaniaon, vaniaoff, vaniastatus).
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VaniaToggleMiddleware } from '../../src/middlewares/VaniaToggleMiddleware.js';
import type { MessageContext } from '../../src/types/index.js';

const mockIsEnabled = vi.fn();

vi.mock('../../src/services/system/Servicemanager.js', () => ({
  serviceManager: {
    vaniaToggleService: {
      isEnabled: (...args: unknown[]) => mockIsEnabled(...args),
    },
  },
}));

describe('VaniaToggleMiddleware', () => {
  let middleware: VaniaToggleMiddleware;
  let mockNext: ReturnType<typeof vi.fn>;
  let mockCtx: MessageContext;

  const createGroupCtx = (command: string): MessageContext =>
    ({
      command,
      args: [],
      message: {} as any,
      sock: {} as any,
      chat: { jid: 'group@test.g.us', isGroup: true, isBotAdmin: false },
      sender: { jid: 'user@test.com', isOwner: false, isAdmin: false },
      reply: vi.fn(),
      react: vi.fn(),
      text: '',
    }) as unknown as MessageContext;

  const createPrivateCtx = (command: string): MessageContext =>
    ({
      command,
      args: [],
      message: {} as any,
      sock: {} as any,
      chat: { jid: 'user@s.whatsapp.net', isGroup: false, isBotAdmin: false },
      sender: { jid: 'user@test.com', isOwner: false, isAdmin: false },
      reply: vi.fn(),
      react: vi.fn(),
      text: '',
    }) as unknown as MessageContext;

  beforeEach(() => {
    middleware = new VaniaToggleMiddleware();
    mockNext = vi.fn().mockResolvedValue(undefined);
    mockIsEnabled.mockResolvedValue(true);
  });

  describe('private chat', () => {
    it('should always allow commands in private chat', async () => {
      mockCtx = createPrivateCtx('test');
      await middleware.execute(mockCtx, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should always allow toggle commands in private chat', async () => {
      for (const cmd of ['vaniaon', 'vaniaoff', 'vaniastatus']) {
        mockCtx = createPrivateCtx(cmd);
        mockNext = vi.fn().mockResolvedValue(undefined);
        await middleware.execute(mockCtx, mockNext);
        expect(mockNext).toHaveBeenCalled();
      }
    });
  });

  describe('group chat - toggle command bypass', () => {
    it('should bypass toggle for vaniaon command', async () => {
      mockCtx = createGroupCtx('vaniaon');
      await middleware.execute(mockCtx, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockIsEnabled).not.toHaveBeenCalled();
    });

    it('should bypass toggle for vaniaoff command', async () => {
      mockCtx = createGroupCtx('vaniaoff');
      await middleware.execute(mockCtx, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockIsEnabled).not.toHaveBeenCalled();
    });

    it('should bypass toggle for vaniastatus command', async () => {
      mockCtx = createGroupCtx('vaniastatus');
      await middleware.execute(mockCtx, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockIsEnabled).not.toHaveBeenCalled();
    });
  });

  describe('group chat - non-toggle commands', () => {
    it('should check toggle status for non-toggle commands', async () => {
      mockCtx = createGroupCtx('help');
      await middleware.execute(mockCtx, mockNext);
      expect(mockIsEnabled).toHaveBeenCalledWith('group@test.g.us');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should block non-toggle commands when bot is disabled', async () => {
      mockIsEnabled.mockResolvedValue(false);
      mockCtx = createGroupCtx('help');
      await middleware.execute(mockCtx, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow non-toggle commands when bot is enabled', async () => {
      mockIsEnabled.mockResolvedValue(true);
      mockCtx = createGroupCtx('ping');
      await middleware.execute(mockCtx, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow continuation if isEnabled throws', async () => {
      mockIsEnabled.mockRejectedValue(new Error('DB error'));
      mockCtx = createGroupCtx('help');
      await middleware.execute(mockCtx, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
