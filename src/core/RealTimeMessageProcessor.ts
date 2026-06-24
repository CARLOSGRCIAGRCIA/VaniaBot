import { EventEmitter } from 'events';

interface QueuedMessage {
  id: string;
  handler: () => Promise<void>;
  parallel?: boolean;
}

export class RealTimeMessageProcessor extends EventEmitter {
  private processing = new Set<string>();
  private sequentialQueue: QueuedMessage[] = [];
  private parallelQueue: QueuedMessage[] = [];
  private isProcessingSequential = false;
  private maxParallel = 3;
  private activeParallel = 0;

  async process(
    messageId: string,
    handler: () => Promise<void>,
    parallel = false,
  ): Promise<boolean> {
    if (this.processing.has(messageId)) return false;
    if (parallel) {
      this.parallelQueue.push({ id: messageId, handler, parallel: true });
    } else {
      this.sequentialQueue.push({ id: messageId, handler, parallel: false });
    }
    this.processParallelQueue().catch(err => this.emit('error', messageId, err));
    this.processSequentialQueue().catch(err => this.emit('error', messageId, err));
    return true;
  }

  private async processParallelQueue(): Promise<void> {
    if (this.activeParallel >= this.maxParallel || this.parallelQueue.length === 0) return;
    const item = this.parallelQueue.shift();
    if (!item) return;
    this.activeParallel++;
    this.processing.add(item.id);
    try {
      await item.handler();
      this.emit('processed', item.id);
    } catch (error) {
      this.emit('error', item.id, error);
    } finally {
      this.processing.delete(item.id);
      this.activeParallel--;
      void this.processParallelQueue();
    }
  }

  private async processSequentialQueue(): Promise<void> {
    if (this.isProcessingSequential || this.sequentialQueue.length === 0) return;
    this.isProcessingSequential = true;
    while (this.sequentialQueue.length > 0) {
      const item = this.sequentialQueue.shift();
      if (!item) break;
      this.processing.add(item.id);
      try {
        await item.handler();
        this.emit('processed', item.id);
      } catch (error) {
        this.emit('error', item.id, error);
      } finally {
        this.processing.delete(item.id);
      }
    }
    this.isProcessingSequential = false;
  }

  getStats() {
    return {
      processing: this.processing.size,
      sequentialQueued: this.sequentialQueue.length,
      parallelQueued: this.parallelQueue.length,
      activeParallel: this.activeParallel,
    };
  }
}
