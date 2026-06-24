import { describe, it, expect, vi } from 'vitest';
import { ErrorHandler } from '../../src/utils/ErrorHandler';
import { VBotError, ErrorCode } from '../../src/utils/errors';

vi.mock('../../src/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  logError: vi.fn(),
}));

describe('ErrorHandler', () => {
  describe('handleCommandError', () => {
    it('should return user-friendly message for VBotError', () => {
      const error = new VBotError('Test', ErrorCode.USER_BANNED, false);
      const message = ErrorHandler.handleCommandError(error, 'test');
      expect(message).toContain('baneado');
    });

    it('should return generic message for unknown errors', () => {
      const message = ErrorHandler.handleCommandError(new Error('Unknown'), 'test');
      expect(message).toContain('Error');
    });
  });

  describe('handleDatabaseError', () => {
    it('should handle file not found', () => {
      const message = ErrorHandler.handleDatabaseError(new Error('ENOENT: not found'), 'get');
      expect(message).toContain('no encontrado');
    });

    it('should handle permission errors', () => {
      const message = ErrorHandler.handleDatabaseError(new Error('permission denied'), 'set');
      expect(message).toContain('permisos');
    });

    it('should handle JSON errors', () => {
      const message = ErrorHandler.handleDatabaseError(new Error('JSON parse error'), 'get');
      expect(message).toContain('formato');
    });
  });

  describe('handleAIError', () => {
    it('should handle API key errors', () => {
      const message = ErrorHandler.handleAIError(new Error('401 API key invalid'));
      expect(message).toContain('API');
    });

    it('should handle rate limit errors', () => {
      const message = ErrorHandler.handleAIError(new Error('429 rate limit exceeded'));
      expect(message).toContain('Límite');
    });

    it('should handle timeout errors', () => {
      const message = ErrorHandler.handleAIError(new Error('timeout'));
      expect(message).toContain('tardó');
    });

    it('should handle service unavailable', () => {
      const message = ErrorHandler.handleAIError(new Error('503 Service Unavailable'));
      expect(message).toContain('no disponible');
    });
  });

  describe('handleDownloadError', () => {
    it('should handle not found errors', () => {
      const message = ErrorHandler.handleDownloadError(new Error('404 Not Found'));
      expect(message).toContain('no encontrado');
    });

    it('should handle permission errors', () => {
      const message = ErrorHandler.handleDownloadError(new Error('403 Forbidden'));
      expect(message).toContain('permiso');
    });

    it('should handle size errors', () => {
      const message = ErrorHandler.handleDownloadError(new Error('file too large'));
      expect(message).toContain('grande');
    });
  });

  describe('handleModerationError', () => {
    it('should handle not admin errors', () => {
      const message = ErrorHandler.handleModerationError(new Error('not admin'));
      expect(message).toContain('administrador');
    });

    it('should handle permission errors', () => {
      const message = ErrorHandler.handleModerationError(new Error('permission denied'));
      expect(message).toContain('permisos');
    });
  });

  describe('isRetryable', () => {
    it('should identify retryable VBotError', () => {
      const error = new VBotError('Timeout', ErrorCode.NETWORK_ERROR, true);
      expect(ErrorHandler.isRetryable(error)).toBe(true);
    });

    it('should identify non-retryable VBotError', () => {
      const error = new VBotError('Not found', ErrorCode.NOT_FOUND, false);
      expect(ErrorHandler.isRetryable(error)).toBe(false);
    });

    it('should identify timeout errors as retryable', () => {
      expect(ErrorHandler.isRetryable(new Error('timeout'))).toBe(true);
    });

    it('should identify network errors as retryable', () => {
      expect(ErrorHandler.isRetryable(new Error('network error'))).toBe(true);
    });

    it('should identify 503 errors as retryable', () => {
      expect(ErrorHandler.isRetryable(new Error('503 Service Unavailable'))).toBe(true);
    });
  });

  describe('getUserMessage', () => {
    it('should return message for USER_BANNED', () => {
      const error = new VBotError('Banned', ErrorCode.USER_BANNED, false);
      expect(ErrorHandler.getUserMessage(error)).toContain('baneado');
    });

    it('should return message for INSUFFICIENT_FUNDS', () => {
      const error = new VBotError('No money', ErrorCode.INSUFFICIENT_FUNDS, false);
      expect(ErrorHandler.getUserMessage(error)).toContain('Fondos');
    });

    it('should return message for RATE_LIMITED', () => {
      const error = new VBotError('Rate limited', ErrorCode.RATE_LIMITED, false);
      expect(ErrorHandler.getUserMessage(error)).toContain('límite');
    });

    it('should return message for PERMISSION_DENIED', () => {
      const error = new VBotError('No permission', ErrorCode.PERMISSION_DENIED, false);
      expect(ErrorHandler.getUserMessage(error)).toContain('permiso');
    });

    it('should return message for NOT_FOUND', () => {
      const error = new VBotError('Not found', ErrorCode.NOT_FOUND, false);
      expect(ErrorHandler.getUserMessage(error)).toContain('No encontrado');
    });
  });
});
