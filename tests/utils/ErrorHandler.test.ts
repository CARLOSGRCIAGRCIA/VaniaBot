/**
 * ErrorHandler.test.ts
 *
 * Unit tests for the ErrorHandler class.
 * Tests error handling, retry logic, and user-friendly messages.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, vi } from 'vitest';
import { ErrorHandler, BotError, ErrorCode } from '../../src/utils/ErrorHandler';

vi.mock('../../src/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  logError: vi.fn(),
}));

describe('ErrorHandler', () => {
  describe('BotError', () => {
    it('should create error with code', () => {
      const error = new BotError('Test error', ErrorCode.DATABASE_ERROR);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
      expect(error.isRetryable).toBe(false);
    });

    it('should create retryable error', () => {
      const error = new BotError('Timeout', ErrorCode.NETWORK_ERROR, {}, true);
      expect(error.isRetryable).toBe(true);
    });

    it('should include context', () => {
      const error = new BotError('Error', ErrorCode.UNKNOWN, { command: 'test' });
      expect(error.context.command).toBe('test');
    });
  });

  describe('handleCommandError', () => {
    it('should return user-friendly message for BotError', () => {
      const error = new BotError('Test', ErrorCode.USER_BANNED);
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
    it('should identify retryable BotError', () => {
      const error = new BotError('Timeout', ErrorCode.NETWORK_ERROR, {}, true);
      expect(ErrorHandler.isRetryable(error)).toBe(true);
    });

    it('should identify non-retryable BotError', () => {
      const error = new BotError('Not found', ErrorCode.NOT_FOUND, {}, false);
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

  describe('retry', () => {
    it('should succeed on first try', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await ErrorHandler.retry(fn, { maxRetries: 3 });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      let attempts = 0;
      const fn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) throw new Error('timeout error');
        return Promise.resolve('success');
      });

      const result = await ErrorHandler.retry(fn, { maxRetries: 3, delayMs: 10 });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('timeout error'));

      await expect(ErrorHandler.retry(fn, { maxRetries: 2, delayMs: 10 })).rejects.toThrow(
        'timeout error',
      );

      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should call onRetry callback', async () => {
      const onRetry = vi.fn();
      const fn = vi.fn().mockRejectedValue(new Error('network error'));

      try {
        await ErrorHandler.retry(fn, { maxRetries: 2, delayMs: 10, onRetry });
      } catch (e) {
        // Expected to throw
      }

      expect(onRetry).toHaveBeenCalled();
    });

    it('should not retry non-retryable errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('validation failed'));

      await expect(ErrorHandler.retry(fn, { maxRetries: 3, delayMs: 10 })).rejects.toThrow(
        'validation failed',
      );

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUserMessage', () => {
    it('should return message for USER_BANNED', () => {
      const error = new BotError('Banned', ErrorCode.USER_BANNED);
      expect(ErrorHandler.getUserMessage(error)).toContain('baneado');
    });

    it('should return message for INSUFFICIENT_FUNDS', () => {
      const error = new BotError('No money', ErrorCode.INSUFFICIENT_FUNDS);
      expect(ErrorHandler.getUserMessage(error)).toContain('Fondos');
    });

    it('should return message for RATE_LIMIT_ERROR', () => {
      const error = new BotError('Rate limited', ErrorCode.RATE_LIMIT_ERROR);
      expect(ErrorHandler.getUserMessage(error)).toContain('límite');
    });

    it('should return message for PERMISSION_ERROR', () => {
      const error = new BotError('No permission', ErrorCode.PERMISSION_ERROR);
      expect(ErrorHandler.getUserMessage(error)).toContain('permiso');
    });

    it('should return message for NOT_FOUND', () => {
      const error = new BotError('Not found', ErrorCode.NOT_FOUND);
      expect(ErrorHandler.getUserMessage(error)).toContain('No encontrado');
    });
  });
});
