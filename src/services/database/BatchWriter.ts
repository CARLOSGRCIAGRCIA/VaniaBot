interface PendingWrite<T = unknown> {
  collection: string;
  key: string;
  value: T;
  timestamp: number;
}

import { logError } from '@/utils/logger.js';

export class BatchWriter {
  private pendingWrites = new Map<string, PendingWrite>();
  private writeTimer: NodeJS.Timeout | null = null;
  private isWriting = false;

  private readonly BATCH_INTERVAL = 3000;
  private readonly MAX_BATCH_SIZE = 100;

  constructor(private writeCallback: (writes: PendingWrite[]) => Promise<void>) {}

  schedule(collection: string, key: string, value: unknown): void {
    const writeKey = `${collection}:${key}`;

    this.pendingWrites.set(writeKey, {
      collection,
      key,
      value,
      timestamp: Date.now(),
    });

    if (this.pendingWrites.size >= this.MAX_BATCH_SIZE) {
      void this.flushNow();
      return;
    }

    if (!this.writeTimer) {
      this.writeTimer = setTimeout(() => {
        void this.flushNow();
      }, this.BATCH_INTERVAL);
    }
  }

  async flushNow(): Promise<void> {
    if (this.isWriting || this.pendingWrites.size === 0) {
      return;
    }

    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }

    this.isWriting = true;

    const writes = Array.from(this.pendingWrites.values());

    try {
      await this.writeCallback(writes);
      this.pendingWrites.clear();
    } catch (error) {
      logError('Batch write error', error);
      for (const w of writes) {
        this.pendingWrites.set(`${w.collection}:${w.key}`, w);
      }
    } finally {
      this.isWriting = false;
    }
  }

  getPendingCount(): number {
    return this.pendingWrites.size;
  }
}
