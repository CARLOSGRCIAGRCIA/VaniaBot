import pino from "pino";
import { createWriteStream } from "fs";
import { join } from "path";

const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

const fileLogger = IS_PRODUCTION
  ? pino(
      {
        level: LOG_LEVEL,
      },
      createWriteStream(join(process.cwd(), "logs", "vania.log"), {
        flags: "a",
      }),
    )
  : null;

const consoleLogger = !IS_PRODUCTION
  ? pino({
      level: LOG_LEVEL,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
          minimumLevel: "info",
        },
      },
    })
  : null;

class AsyncLogger {
  private queue: Array<{ level: string; args: any[] }> = [];
  private isProcessing = false;
  private processTimer: NodeJS.Timeout | null = null;

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const batch = this.queue.splice(0, 100);

    for (const { level, args } of batch) {
      if (IS_PRODUCTION && fileLogger) {
        (fileLogger as any)[level](...args);
      } else if (consoleLogger) {
        (consoleLogger as any)[level](...args);
      }
    }

    this.isProcessing = false;

    if (this.queue.length > 0) {
      setImmediate(() => this.processQueue());
    }
  }

  private schedule(level: string, ...args: any[]) {
    this.queue.push({ level, args });

    if (!this.processTimer) {
      this.processTimer = setTimeout(() => {
        this.processTimer = null;
        this.processQueue();
      }, 100);
    }
  }

  info(...args: any[]) {
    if (LOG_LEVEL === "error" || LOG_LEVEL === "warn") return;
    this.schedule("info", ...args);
  }

  warn(...args: any[]) {
    if (LOG_LEVEL === "error") return;
    this.schedule("warn", ...args);
  }

  error(...args: any[]) {
    this.schedule("error", ...args);
  }

  debug(...args: any[]) {
    if (LOG_LEVEL !== "debug") return;
    this.schedule("debug", ...args);
  }

  async flush() {
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
