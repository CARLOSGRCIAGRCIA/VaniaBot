import pLimit, { type Limit } from 'p-limit';
import { LRUCache } from 'lru-cache';
import { logger } from '@/utils/logger.js';

export interface DownloadTask<T = unknown> {
  id: string;
  priority: number;
  execute: () => Promise<T>;
  onSuccess?: (result: T) => void;
  onError?: (error: Error) => void;
}

export interface DownloadQueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cacheSize: number;
}

interface QueuedTask {
  id: string;
  priority: number;
  execute: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

interface CachedResult<T> {
  result: T;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_SIZE = 50;

export class DownloadQueueService {
  private static instance: DownloadQueueService;
  private queue: QueuedTask[] = [];
  private processing = 0;
  private completed = 0;
  private failed = 0;
  private limit: Limit;
  private maxConcurrent: number;
  private resultCache: LRUCache<string, CachedResult<unknown>>;
  private activeTasks = new Map<string, Promise<unknown>>();

  private constructor(maxConcurrent = 4) {
    this.maxConcurrent = maxConcurrent;
    this.limit = pLimit(maxConcurrent);
    this.resultCache = new LRUCache<string, CachedResult<unknown>>({
      max: CACHE_MAX_SIZE,
      ttl: CACHE_TTL_MS,
      updateAgeOnGet: true,
    });
  }

  static getInstance(maxConcurrent?: number): DownloadQueueService {
    if (!DownloadQueueService.instance) {
      DownloadQueueService.instance = new DownloadQueueService(maxConcurrent);
    }
    return DownloadQueueService.instance;
  }

  async add<T>(task: DownloadTask<T>): Promise<T> {
    const cached = this.resultCache.get(task.id) as CachedResult<T> | undefined;
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      logger.debug(`[Queue] Cache hit for task ${task.id}`);
      return cached.result;
    }

    const activeTask = this.activeTasks.get(task.id);
    if (activeTask) {
      logger.debug(`[Queue] Task ${task.id} already in progress`);
      return activeTask as Promise<T>;
    }

    const taskPromise = new Promise<T>((resolve, reject) => {
      const queuedTask: QueuedTask = {
        id: task.id,
        priority: task.priority,
        execute: async () => {
          try {
            const result = await task.execute();
            task.onSuccess?.(result);
            this.completed++;
            this.resultCache.set(task.id, { result, timestamp: Date.now() });
            return result;
          } catch (error) {
            this.failed++;
            task.onError?.(error as Error);
            throw error;
          }
        },
        resolve: resolve as (value: unknown) => void,
        reject,
      };

      this.queue.push(queuedTask);
      this.queue.sort((a, b) => b.priority - a.priority);

      void this.processNext();
    });

    this.activeTasks.set(task.id, taskPromise as unknown as Promise<unknown>);

    taskPromise
      .finally(() => {
        this.activeTasks.delete(task.id);
      })
      .catch(() => {});

    return taskPromise;
  }

  private async processNext(): Promise<void> {
    if (this.processing >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift();
    if (!task) return;

    this.processing++;

    void this.limit(async () => {
      try {
        await task.execute();
      } catch {
        // Error already handled in wrapped task
      } finally {
        this.processing--;
        void this.processNext();
      }
    }).catch(() => {
      this.processing--;
      void this.processNext();
    });
  }

  getStats(): DownloadQueueStats {
    return {
      pending: this.queue.length,
      processing: this.processing,
      completed: this.completed,
      failed: this.failed,
      cacheSize: this.resultCache.size,
    };
  }

  clear(): void {
    this.queue = [];
    this.resultCache.clear();
  }

  clearCache(): void {
    this.resultCache.clear();
    logger.info('[Queue] Result cache cleared');
  }

  setConcurrency(concurrency: number): void {
    this.maxConcurrent = concurrency;
    this.limit = pLimit(concurrency);
  }
}

export class ParallelDownloader {
  private queue: DownloadQueueService;

  constructor(maxConcurrent = 4) {
    this.queue = DownloadQueueService.getInstance(maxConcurrent);
  }

  async downloadAll<T>(
    tasks: Array<{ id: string; execute: () => Promise<T> }>,
  ): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    const errors: Array<{ id: string; error: Error }> = [];

    const promises = tasks.map(task =>
      this.queue
        .add({
          id: task.id,
          priority: 1,
          execute: task.execute,
        })
        .then(result => {
          results.set(task.id, result);
        })
        .catch(error => {
          errors.push({ id: task.id, error: error as Error });
        }),
    );

    await Promise.allSettled(promises);

    if (errors.length > 0) {
      logger.warn(`Parallel download: ${errors.length} tasks failed`, {
        errors: errors.map(e => ({ id: e.id, message: e.error.message })),
      });
    }

    return results;
  }

  getStats(): DownloadQueueStats {
    return this.queue.getStats();
  }
}

export const downloadQueue = DownloadQueueService.getInstance(4);
