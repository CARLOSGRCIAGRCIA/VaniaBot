import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { dirname } from 'path';
import { logError, logger } from '@/utils/logger.js';

interface PendingWrite<T = unknown> {
  collection: string;
  key: string;
  value: T;
  timestamp: number;
}

interface WALEntry {
  id: string;
  writes: PendingWrite[];
  createdAt: number;
}

export class BatchWriter {
  private pendingWrites = new Map<string, PendingWrite>();
  private writeTimer: NodeJS.Timeout | null = null;
  private isWriting = false;
  private walPath: string;
  private currentWalId: string = '';

  private readonly BATCH_INTERVAL = 3000;
  private readonly MAX_BATCH_SIZE = 100;
  private readonly WAL_DIR = './data/wal';

  constructor(
    private writeCallback: (writes: PendingWrite[]) => Promise<void>,
    dbPath?: string,
  ) {
    const dir = dbPath ? dirname(dbPath) : './data';
    this.walPath = path.join(dir, 'wal', 'pending_writes.json');
    this.initializeWAL();
  }

  private initializeWAL(): void {
    try {
      const walDir = dirname(this.walPath);
      if (!existsSync(walDir)) {
        mkdirSync(walDir, { recursive: true });
      }

      if (existsSync(this.walPath)) {
        try {
          const data = readFileSync(this.walPath, 'utf-8');
          const wal: WALEntry = JSON.parse(data);

          if (wal.writes && Array.isArray(wal.writes) && wal.writes.length > 0) {
            for (const write of wal.writes) {
              this.pendingWrites.set(`${write.collection}:${write.key}`, write);
            }
            this.currentWalId = wal.id;
            logger.info(`[WAL] Recovered ${wal.writes.length} pending writes`);
          }
        } catch {
          rmSync(this.walPath);
        }
      }
    } catch (error) {
      logError('[WAL] Failed to initialize', error);
    }
  }

  private persistWAL(): void {
    try {
      const wal: WALEntry = {
        id: this.currentWalId || crypto.randomUUID(),
        writes: Array.from(this.pendingWrites.values()),
        createdAt: Date.now(),
      };

      writeFileSync(this.walPath, JSON.stringify(wal, null, 2), 'utf-8');
      this.currentWalId = wal.id;
    } catch (error) {
      logError('[WAL] Failed to persist', error);
    }
  }

  private clearWAL(): void {
    try {
      if (existsSync(this.walPath)) {
        rmSync(this.walPath);
      }
      this.currentWalId = '';
    } catch (error) {
      logError('[WAL] Failed to clear', error);
    }
  }

  schedule(collection: string, key: string, value: unknown): void {
    const writeKey = `${collection}:${key}`;

    this.pendingWrites.set(writeKey, {
      collection,
      key,
      value,
      timestamp: Date.now(),
    });

    this.persistWAL();

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
      this.clearWAL();
    } catch (error) {
      logError('Batch write error', error);
      for (const w of writes) {
        this.pendingWrites.set(`${w.collection}:${w.key}`, w);
      }
      this.persistWAL();
    } finally {
      this.isWriting = false;
    }
  }

  getPendingCount(): number {
    return this.pendingWrites.size;
  }

  hasPendingWrites(): boolean {
    return this.pendingWrites.size > 0;
  }

  resetForTesting(): void {
    this.pendingWrites.clear();
    this.clearWAL();
  }
}

import path from 'path';
