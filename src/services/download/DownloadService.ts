import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { logger } from '@/utils/logger.js';

export interface DownloadResult {
  success: boolean;
  filePath?: string;
  size?: string;
  source?: string;
  error?: string;
}

export class DownloadService {
  private static readonly TEMP_DIR = './data/temp/downloads';
  private static readonly MAX_AUDIO_SIZE_MB = 50;
  private static readonly MAX_VIDEO_SIZE_MB = 100;

  constructor() {
    if (!fs.existsSync(DownloadService.TEMP_DIR)) {
      fs.mkdirSync(DownloadService.TEMP_DIR, { recursive: true });
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
          console.error('Cleanup error:', error);
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
}
