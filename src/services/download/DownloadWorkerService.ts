import { Worker } from 'worker_threads';
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
  private readonly WORKER_COUNT = 2;
  private readonly TASK_TIMEOUT = 180000;
  private workerIndex = 0;
  private readyWorkers = 0;

  constructor() {
    this.initializeWorkers();
  }

  private initializeWorkers(): void {
    const workerPath = new URL('../workers/download.worker.js', import.meta.url).href;

    for (let i = 0; i < this.WORKER_COUNT; i++) {
      try {
        const worker = new Worker(workerPath, {
          execArgv: ['-r', 'ts-node/esm'],
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
    const worker = this.workers[this.workerIndex];
    this.workerIndex = (this.workerIndex + 1) % this.workers.length;
    return worker;
  }

  async download(task: DownloadTask): Promise<DownloadResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(task.id);
        reject(new Error('Download timeout'));
      }, this.TASK_TIMEOUT);

      this.pending.set(task.id, { resolve, reject, timeout });

      const worker = this.getNextWorker();
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

  getStats(): { activeWorkers: number; pendingTasks: number } {
    return {
      activeWorkers: this.workers.length,
      pendingTasks: this.pending.size,
    };
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
