import { EventEmitter } from 'events';

export interface MessageProcessorStats {
  processing: number;
  queued: number;
}

export class MessageProcessorService extends EventEmitter {
  private processing = new Set<string>();
  private queue: Array<{ id: string; handler: () => Promise<void> }> = [];
  private isProcessingQueue = false;

  async process(messageId: string, handler: () => Promise<void>): Promise<boolean> {
    if (this.processing.has(messageId)) return false;
    this.queue.push({ id: messageId, handler });
    this.processQueue().catch(err => this.emit('error', messageId, err));
    return true;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.queue.length === 0) return;
    this.isProcessingQueue = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
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

    this.isProcessingQueue = false;
  }

  getStats(): MessageProcessorStats {
    return { processing: this.processing.size, queued: this.queue.length };
  }

  isMessageProcessing(messageId: string): boolean {
    return this.processing.has(messageId);
  }

  clearQueue(): void {
    this.queue = [];
  }
}

export const messageProcessorService = new MessageProcessorService();
