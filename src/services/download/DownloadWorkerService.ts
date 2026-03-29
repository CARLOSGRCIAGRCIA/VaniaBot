import { Worker } from 'worker_threads';
import { LRUCache } from 'lru-cache';
import { logger, logError } from '@/utils/logger.js';
import type { DownloadResult } from './DownloadService.js';

export interface DownloadTask {
  id: string;
  type:
    | 'youtube-audio'
    | 'youtube-video'
    | 'tiktok-video'
    | 'tiktok-audio'
    | 'instagram'
    | 'twitter'
    | 'facebook'
    | 'spotify';
  url: string;
  options?: Record<string, unknown>;
}

interface WorkerResponse {
  id: string;
  success: boolean;
  result?: DownloadResult;
  error?: string;
}

interface CachedDownload {
  result: DownloadResult;
  timestamp: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_SIZE = 100;

export class DownloadWorkerService {
  private workers: Worker[] = [];
  private pending = new Map<
    string,
    {
      resolve: (result: DownloadResult) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();
  private readonly WORKER_COUNT = 4;
  private readonly TASK_TIMEOUT = 120000;
  private workerIndex = 0;
  private readyWorkers = 0;
  private downloadCache: LRUCache<string, CachedDownload>;
  private processingUrls = new Set<string>();

  constructor() {
    this.downloadCache = new LRUCache<string, CachedDownload>({
      max: CACHE_MAX_SIZE,
      ttl: CACHE_TTL_MS,
      updateAgeOnGet: true,
    });
    this.initializeWorkers();
  }

  private getCacheKey(url: string, type: string): string {
    return `${type}:${url}`;
  }

  private getFromCache(url: string, type: string): DownloadResult | null {
    const key = this.getCacheKey(url, type);
    const cached = this.downloadCache.get(key);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      logger.debug(`[DownloadWorker] Cache hit for ${type}: ${url}`);
      return cached.result;
    }

    return null;
  }

  private setCache(url: string, type: string, result: DownloadResult): void {
    if (result.success) {
      const key = this.getCacheKey(url, type);
      this.downloadCache.set(key, {
        result,
        timestamp: Date.now(),
      });
    }
  }

  private initializeWorkers(): void {
    const workerPath = new URL('../workers/download.worker.js', import.meta.url).href;

    for (let i = 0; i < this.WORKER_COUNT; i++) {
      try {
        const worker = new Worker(workerPath, {
          execArgv:
            process.env.NODE_ENV === 'production' ? ['--no-warnings'] : ['-r', 'ts-node/esm'],
        });

        worker.on('message', (message: WorkerResponse | { type: string }) => {
          if ('type' in message && message.type === 'ready') {
            this.readyWorkers++;
            if (this.readyWorkers === this.WORKER_COUNT) {
              logger.info(`[DownloadWorker] ${this.WORKER_COUNT} workers ready`);
            }
            return;
          }

          const response = message as WorkerResponse;
          const pending = this.pending.get(response.id);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pending.delete(response.id);

            const taskData = (worker as unknown as { currentTask?: { url: string; type: string } })
              .currentTask;
            if (taskData && response.success && response.result) {
              this.setCache(taskData.url, taskData.type, response.result);
              this.processingUrls.delete(taskData.url);
            }

            if (response.success && response.result) {
              pending.resolve(response.result);
            } else {
              pending.resolve({
                success: false,
                error: response.result?.error || response.error || 'Unknown error',
              });
            }
          }
        });

        worker.on('error', error => {
          logError('[DownloadWorker] Worker error', error);
        });

        worker.on('exit', code => {
          if (code !== 0) {
            logger.warn(`[DownloadWorker] Worker exited with code ${code}, restarting...`);
            const index = this.workers.indexOf(worker);
            if (index !== -1) {
              this.workers.splice(index, 1);
              this.initializeWorkers();
            }
          }
        });

        this.workers.push(worker);
      } catch (error) {
        logError('[DownloadWorker] Failed to create worker', error);
      }
    }
  }

  private getNextWorker(): Worker {
    for (const worker of this.workers) {
      const workerAny = worker as unknown as { currentTask?: unknown };
      if (!workerAny.currentTask) {
        return worker;
      }
    }
    const worker = this.workers[this.workerIndex];
    this.workerIndex = (this.workerIndex + 1) % this.workers.length;
    return worker;
  }

  async download(task: DownloadTask): Promise<DownloadResult> {
    const cached = this.getFromCache(task.url, task.type);
    if (cached) {
      return cached;
    }

    if (this.processingUrls.has(task.url)) {
      logger.debug(`[DownloadWorker] URL already being processed: ${task.url}`);
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (!this.processingUrls.has(task.url)) {
            clearInterval(checkInterval);
            const newCached = this.getFromCache(task.url, task.type);
            resolve(newCached || { success: false, error: 'Download cancelled' });
          }
        }, 500);

        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error('Download wait timeout'));
        }, this.TASK_TIMEOUT);
      });
    }

    this.processingUrls.add(task.url);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(task.id);
        this.processingUrls.delete(task.url);
        reject(new Error('Download timeout'));
      }, this.TASK_TIMEOUT);

      this.pending.set(task.id, { resolve, reject, timeout });

      const worker = this.getNextWorker();
      (worker as unknown as { currentTask?: { url: string; type: string } }).currentTask = {
        url: task.url,
        type: task.type,
      };
      worker.postMessage({ type: 'download', task });
    });
  }

  async downloadYouTubeAudio(url: string): Promise<DownloadResult> {
    return this.download({
      id: crypto.randomUUID(),
      type: 'youtube-audio',
      url,
    });
  }

  async downloadYouTubeVideo(url: string): Promise<DownloadResult> {
    return this.download({
      id: crypto.randomUUID(),
      type: 'youtube-video',
      url,
    });
  }

  async downloadTikTok(url: string, type: 'video' | 'audio' = 'video'): Promise<DownloadResult> {
    return this.download({
      id: crypto.randomUUID(),
      type: type === 'video' ? 'tiktok-video' : 'tiktok-audio',
      url,
    });
  }

  async downloadInstagram(url: string): Promise<DownloadResult> {
    return this.download({
      id: crypto.randomUUID(),
      type: 'instagram',
      url,
    });
  }

  async downloadTwitter(url: string): Promise<DownloadResult> {
    return this.download({
      id: crypto.randomUUID(),
      type: 'twitter',
      url,
    });
  }

  async downloadFacebook(url: string): Promise<DownloadResult> {
    return this.download({
      id: crypto.randomUUID(),
      type: 'facebook',
      url,
    });
  }

  async downloadSpotify(url: string): Promise<DownloadResult> {
    return this.download({
      id: crypto.randomUUID(),
      type: 'spotify',
      url,
    });
  }

  getStats(): { activeWorkers: number; pendingTasks: number; cacheSize: number } {
    return {
      activeWorkers: this.workers.length,
      pendingTasks: this.pending.size,
      cacheSize: this.downloadCache.size,
    };
  }

  clearCache(): void {
    this.downloadCache.clear();
    logger.info('[DownloadWorker] Cache cleared');
  }

  async shutdown(): Promise<void> {
    for (const worker of this.workers) {
      await worker.terminate();
    }
    this.workers = [];
    logger.info('[DownloadWorker] Shutdown complete');
  }
}

export const downloadWorkerService = new DownloadWorkerService();
