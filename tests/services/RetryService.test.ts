import { describe, it, expect, beforeEach } from 'vitest';
import { RetryService, withRetry } from '../../src/services/system/RetryService.js';

describe('RetryService', () => {
  let retryService: RetryService;

  beforeEach(() => {
    retryService = new RetryService(
      {
        maxAttempts: 3,
        baseDelay: 5,
        maxDelay: 50,
        backoffMultiplier: 2,
      },
      'test-retry',
    );
  });

  it('should succeed on first try', async () => {
    const result = await retryService.execute(async () => 'success');

    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
  });

  it('should fail after max attempts', async () => {
    const result = await retryService.execute(async () => {
      throw new Error('always fails');
    });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3);
  });
});

describe('withRetry', () => {
  it('should return result on success', async () => {
    const result = await withRetry(async () => 'success', { maxAttempts: 3, baseDelay: 5 });
    expect(result).toBe('success');
  });

  it('should throw on failure', async () => {
    await expect(
      withRetry(
        async () => {
          throw new Error('fail');
        },
        { maxAttempts: 2, baseDelay: 5 },
      ),
    ).rejects.toThrow('fail');
  });
});
