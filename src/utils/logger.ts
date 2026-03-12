import pino from 'pino';
import { createWriteStream } from 'fs';
import { join } from 'path';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const fileLogger = IS_PRODUCTION
  ? pino(
      { level: LOG_LEVEL },
      createWriteStream(join(process.cwd(), 'logs', 'vania.log'), { flags: 'a' }),
    )
  : null;

const consoleLogger = !IS_PRODUCTION
  ? pino({
      level: LOG_LEVEL,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
          minimumLevel: 'info',
        },
      },
    })
  : null;

// Type-safe accessor for pino log methods
type PinoLogger = typeof fileLogger | typeof consoleLogger;
function pinoLog(pinoInst: PinoLogger, level: string, args: unknown[]): void {
  if (!pinoInst) return;
  (pinoInst as unknown as Record<string, (...a: unknown[]) => void>)[level]?.(...args);
}

class AsyncLogger {
  private queue: Array<{ level: string; args: unknown[] }> = [];
  private isProcessing = false;
  private processTimer: NodeJS.Timeout | null = null;

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const batch = this.queue.splice(0, 100);

    for (const { level, args } of batch) {
      if (IS_PRODUCTION) {
        pinoLog(fileLogger, level, args);
      } else {
        pinoLog(consoleLogger, level, args);
      }
    }

    this.isProcessing = false;

    if (this.queue.length > 0) {
      setImmediate(() => {
        void this.processQueue();
      });
    }
  }

  private schedule(level: string, ...args: unknown[]): void {
    this.queue.push({ level, args });

    if (!this.processTimer) {
      this.processTimer = setTimeout(() => {
        this.processTimer = null;
        void this.processQueue();
      }, 100);
    }
  }

  info(...args: unknown[]): void {
    if (LOG_LEVEL === 'error' || LOG_LEVEL === 'warn') return;
    this.schedule('info', ...args);
  }

  warn(...args: unknown[]): void {
    if (LOG_LEVEL === 'error') return;
    this.schedule('warn', ...args);
  }

  error(...args: unknown[]): void {
    this.schedule('error', ...args);
  }

  debug(...args: unknown[]): void {
    if (LOG_LEVEL !== 'debug') return;
    this.schedule('debug', ...args);
  }

  async flush(): Promise<void> {
    await this.processQueue();
  }
}

export const logger = new AsyncLogger();

export function logError(context: string, error: unknown): void {
  if (error instanceof Error) {
    logger.error({
      context,
      message: error.message,
      stack: IS_PRODUCTION ? undefined : error.stack,
      name: error.name,
    });
  } else {
    logger.error({ context, error: String(error) });
  }
}
