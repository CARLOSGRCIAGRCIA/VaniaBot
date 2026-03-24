import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { logError, logger } from '@/utils/logger.js';

export interface DownloadResult {
  success: boolean;
  filePath?: string;
  size?: string;
  source?: string;
  error?: string;
}

const BLOCKED_URL_PATTERNS = [
  /[;&|`$<>{}]/, // Shell metacharacters
  /localhost/i, // Localhost
  /127\.\d+\.\d+\.\d+/, // Loopback
  /10\.\d+\.\d+\.\d+/, // Private Class A
  /172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/, // Private Class B
  /192\.168\.\d+\.\d+/, // Private Class C
  /0\.0\.0\.0/, // All interfaces
  /::1/, // IPv6 loopback
  /fc00:/i, // IPv6 private
  /fe80:/i, // IPv6 link-local
];

export class DownloadService {
  private static readonly TEMP_DIR = './data/temp/downloads';
  private static readonly MAX_AUDIO_SIZE_MB = 50;
  private static readonly MAX_VIDEO_SIZE_MB = 100;

  constructor() {
    if (!fs.existsSync(DownloadService.TEMP_DIR)) {
      fs.mkdirSync(DownloadService.TEMP_DIR, { recursive: true });
    }
  }

  protected getDownloadPrefix(): string {
    return '';
  }

  protected resolveOutputPath?(expectedPath: string): string | null;

  protected validateUrl(url: string): { valid: boolean; error?: string } {
    if (!url || url.trim().length === 0) {
      return { valid: false, error: 'URL is empty' };
    }

    if (url.length > 2048) {
      return { valid: false, error: 'URL too long' };
    }

    try {
      const parsed = new URL(url);

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, error: 'Only HTTP/HTTPS URLs allowed' };
      }

      for (const pattern of BLOCKED_URL_PATTERNS) {
        if (pattern.test(url)) {
          return { valid: false, error: 'URL contains blocked patterns' };
        }
      }

      const hostname = parsed.hostname.toLowerCase();
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return { valid: false, error: 'Localhost URLs not allowed' };
      }

      return { valid: true };
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }
  }

  protected runCommand(cmd: string, args: string[], timeout: number = 90000): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(cmd, args);
      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        process.kill();
        reject(new Error('Command timeout'));
      }, timeout);

      process.stdout.on('data', data => {
        stdout += data.toString();
      });

      process.stderr.on('data', data => {
        stderr += data.toString();
      });

      process.on('close', code => {
        clearTimeout(timer);
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `Exit code: ${code}`));
        }
      });

      process.on('error', reject);
    });
  }

  protected checkFileSize(
    filePath: string,
    type: 'audio' | 'video',
  ): { valid: boolean; sizeMB: number } {
    const stats = fs.statSync(filePath);
    const sizeMB = stats.size / (1024 * 1024);
    const maxSize =
      type === 'audio' ? DownloadService.MAX_AUDIO_SIZE_MB : DownloadService.MAX_VIDEO_SIZE_MB;

    return {
      valid: sizeMB <= maxSize,
      sizeMB: parseFloat(sizeMB.toFixed(2)),
    };
  }

  protected sanitizeFilename(filename: string, maxLength: number = 60): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, maxLength);
  }

  protected async cleanup(filePath: string, delay: number = 30000): Promise<void> {
    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          logger.debug(`🗑️ Cleaned up: ${path.basename(filePath)}`);
        } catch (error) {
          logError('DownloadService cleanup', error);
        }
      }
    }, delay);
  }

  protected getTempDir(): string {
    return DownloadService.TEMP_DIR;
  }

  protected generateOutputPath(filename: string, extension: string): string {
    const sanitized = this.sanitizeFilename(filename);
    return path.join(this.getTempDir(), `${sanitized}_${Date.now()}.${extension}`);
  }

  protected async tryDownloadMethods(
    methods: Array<{ name: string; cmd: string; args: string[] }>,
    outputPath: string,
    type: 'audio' | 'video',
  ): Promise<DownloadResult> {
    const prefix = this.getDownloadPrefix();
    const tag = prefix ? `[${prefix}]` : '';
    let lastError = '';

    for (const method of methods) {
      try {
        logger.debug(`${tag} Trying ${method.name}...`);

        await this.runCommand(method.cmd, method.args, 180000);

        let resolvedPath = outputPath;
        if (this.resolveOutputPath) {
          resolvedPath = this.resolveOutputPath(outputPath) ?? outputPath;
        }

        if (fs.existsSync(resolvedPath)) {
          const sizeCheck = this.checkFileSize(resolvedPath, type);

          if (!sizeCheck.valid) {
            fs.unlinkSync(resolvedPath);
            return {
              success: false,
              error: `File too large: ${sizeCheck.sizeMB}MB`,
            };
          }

          logger.debug(`${tag} ${method.name} succeeded: ${sizeCheck.sizeMB}MB`);

          return {
            success: true,
            filePath: resolvedPath,
            size: sizeCheck.sizeMB.toString(),
            source: method.name,
          };
        }
      } catch (error) {
        const err = error as Error;
        lastError = err.message;
        logger.debug(`${tag} ${method.name} failed: ${err.message}`);
        continue;
      }
    }

    return {
      success: false,
      error: `Descarga fallida. Verifica que yt-dlp y ffmpeg estén instalados. Error: ${lastError}`,
    };
  }
}
