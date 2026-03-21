import type { DownloadResult } from './DownloadService.js';
import { DownloadService } from './DownloadService.js';
import { logError } from '@/utils/logger.js';
import fs from 'fs';

export interface InstagramMedia {
  title: string;
  author: string;
  url: string;
  type: 'video' | 'image' | 'unknown';
}

export class InstagramDownloader extends DownloadService {
  protected getDownloadPrefix(): string {
    return 'Instagram';
  }

  protected resolveOutputPath(expectedPath: string): string | null {
    if (fs.existsSync(expectedPath)) return expectedPath;

    const dir = expectedPath.substring(0, expectedPath.lastIndexOf('/'));
    const base = expectedPath.substring(expectedPath.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');

    try {
      const files = fs.readdirSync(dir);
      const match = files.find(f => f.startsWith(base));
      if (match) return `${dir}/${match}`;
    } catch {
      // Ignorar errores de lectura
    }

    return null;
  }

  isValidUrl(url: string): boolean {
    return /instagram\.com\/(p|reel|reels|tv|stories)\//i.test(url);
  }

  async getMediaInfo(url: string): Promise<InstagramMedia | null> {
    try {
      const output = await this.runCommand('yt-dlp', ['--dump-json', '--no-download', url], 30000);
      const info = JSON.parse(output.trim().split('\n')[0]);

      const ext: string = info.ext ?? '';
      const type: InstagramMedia['type'] = ['mp4', 'mov', 'webm'].includes(ext)
        ? 'video'
        : ['jpg', 'jpeg', 'png', 'webp'].includes(ext)
          ? 'image'
          : 'unknown';

      return {
        title: info.title ?? 'Instagram post',
        author: info.uploader ?? info.channel ?? 'unknown',
        url,
        type,
      };
    } catch (error) {
      logError('Instagram getMediaInfo', error);
      return null;
    }
  }

  async downloadVideo(url: string): Promise<DownloadResult> {
    const validation = this.validateUrl(url);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const outputPath = this.generateOutputPath('instagram', 'mp4');

    const methods = [
      {
        name: 'yt-dlp',
        cmd: 'yt-dlp',
        args: ['-f', 'best', '--no-check-certificate', '-o', outputPath, url],
      },
      {
        name: 'yt-dlp (fallback)',
        cmd: 'yt-dlp',
        args: ['-o', outputPath, url],
      },
    ];

    return await this.tryDownloadMethods(methods, outputPath, 'video');
  }

  async downloadImage(url: string): Promise<DownloadResult> {
    const validation = this.validateUrl(url);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const outputPath = this.generateOutputPath('instagram_img', 'jpg');

    const methods = [
      {
        name: 'yt-dlp image',
        cmd: 'yt-dlp',
        args: ['--no-check-certificate', '-o', outputPath, url],
      },
    ];

    return await this.tryDownloadMethods(methods, outputPath, 'video');
  }
}
