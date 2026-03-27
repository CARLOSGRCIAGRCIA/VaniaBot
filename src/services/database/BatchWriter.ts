import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  renameSync,
  unlinkSync,
} from 'fs';
import { dirname } from 'path';
import path from 'path';
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
  private criticalWrites = new Set<string>();

  private readonly BATCH_INTERVAL = 2000;
  private readonly MAX_BATCH_SIZE = 50;
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

      const tmpFiles = [this.walPath + '.tmp', this.walPath + '.tmp_write'];
      for (const tmpFile of tmpFiles) {
        if (existsSync(tmpFile)) {
          unlinkSync(tmpFile);
          logger.warn(`[WAL] Cleaned orphan: ${tmpFile}`);
        }
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

      const tmpPath = this.walPath + '.tmp';
      writeFileSync(tmpPath, JSON.stringify(wal, null, 2), 'utf-8');
      renameSync(tmpPath, this.walPath);
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
    const isCritical = this.criticalWrites.has(collection);

    this.pendingWrites.set(writeKey, {
      collection,
      key,
      value,
      timestamp: Date.now(),
    });

    this.persistWAL();

    if (isCritical || this.pendingWrites.size >= this.MAX_BATCH_SIZE) {
      void this.flushNow();
      return;
    }

    if (!this.writeTimer) {
      const delay = isCritical ? 500 : this.BATCH_INTERVAL;
      this.writeTimer = setTimeout(() => {
        void this.flushNow();
      }, delay);
    }
  }

  markCritical(collection: string): void {
    this.criticalWrites.add(collection);
  }

  unmarkCritical(collection: string): void {
    this.criticalWrites.delete(collection);
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
