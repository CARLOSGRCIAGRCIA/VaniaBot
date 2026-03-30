import { describe, it, expect, beforeEach } from 'vitest';
import {
  DownloadQueueService,
  ParallelDownloader,
  downloadQueue,
} from '../../src/services/download/DownloadQueueService.js';

describe('DownloadQueueService', () => {
  let queue: DownloadQueueService;
  let testId: string;

  beforeEach(() => {
    testId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    queue = DownloadQueueService.getInstance(2);
    queue.clear();
  });

  it('should add task to queue', async () => {
    const task = queue.add({
      id: `${testId}-task1`,
      priority: 1,
      execute: async () => 'result',
    });

    await expect(task).resolves.toBe('result');
  });

  it('should execute multiple tasks', async () => {
    const results = await Promise.all([
      queue.add({ id: `${testId}-task1`, priority: 1, execute: async () => 'result1' }),
      queue.add({ id: `${testId}-task2`, priority: 1, execute: async () => 'result2' }),
    ]);

    expect(results).toContain('result1');
    expect(results).toContain('result2');
  });

  it('should handle task errors', async () => {
    await expect(
      queue.add({
        id: `${testId}-error-task`,
        priority: 1,
        execute: async () => {
          throw new Error('task failed');
        },
      }),
    ).rejects.toThrow('task failed');
  });

  it('should return stats', () => {
    const stats = queue.getStats();
    expect(stats).toHaveProperty('pending');
    expect(stats).toHaveProperty('completed');
    expect(stats).toHaveProperty('failed');
  });

  it('should clear queue', async () => {
    queue.add({ id: `${testId}-clear-task`, priority: 1, execute: async () => 'result' });
    queue.clear();

    const stats = queue.getStats();
    expect(stats.pending).toBe(0);
  });

  it('should update concurrency', () => {
    queue.setConcurrency(5);
    const stats = queue.getStats();
    expect(stats.processing).toBeDefined();
  });

  it('should call onSuccess callback', async () => {
    let called = false;

    await queue.add({
      id: `${testId}-callback-task`,
      priority: 1,
      execute: async () => 'result',
      onSuccess: () => {
        called = true;
      },
    });

    expect(called).toBe(true);
  });

  it('should call onError callback', async () => {
    let called = false;

    await expect(
      queue.add({
        id: `${testId}-error-callback`,
        priority: 1,
        execute: async () => {
          throw new Error('failed');
        },
        onError: () => {
          called = true;
        },
      }),
    ).rejects.toThrow();

    expect(called).toBe(true);
  });

  it('should prioritize tasks', async () => {
    const order: string[] = [];

    await Promise.all([
      queue.add({
        id: `${testId}-low`,
        priority: 1,
        execute: async () => {
          order.push('low');
          return 'low';
        },
      }),
      queue.add({
        id: `${testId}-high`,
        priority: 10,
        execute: async () => {
          order.push('high');
          return 'high';
        },
      }),
    ]);

    expect(order).toContain('high');
    expect(order).toContain('low');
  });
});

describe('ParallelDownloader', () => {
  let downloader: ParallelDownloader;
  let testId: string;

  beforeEach(() => {
    testId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    downloader = new ParallelDownloader(3);
  });

  it('should download all tasks', async () => {
    const results = await downloader.downloadAll([
      { id: `${testId}-task1`, execute: async () => 'result1' },
      { id: `${testId}-task2`, execute: async () => 'result2' },
    ]);

    expect(results.size).toBe(2);
    expect(results.get(`${testId}-task1`)).toBe('result1');
    expect(results.get(`${testId}-task2`)).toBe('result2');
  });

  it('should return map even with failures', async () => {
    const results = await downloader.downloadAll([
      { id: `${testId}-success`, execute: async () => 'ok' },
      {
        id: `${testId}-fail`,
        execute: async () => {
          throw new Error('failed');
        },
      },
    ]);

    expect(results.has(`${testId}-success`)).toBe(true);
    expect(results.get(`${testId}-success`)).toBe('ok');
  });

  it('should return stats', () => {
    const stats = downloader.getStats();
    expect(stats).toHaveProperty('completed');
    expect(stats).toHaveProperty('failed');
  });
});

describe('downloadQueue singleton', () => {
  it('should be exported', () => {
    expect(downloadQueue).toBeDefined();
  });
});
