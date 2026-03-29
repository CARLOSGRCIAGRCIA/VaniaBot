import type { DownloadResult } from './DownloadService.js';
import { DownloadService } from './DownloadService.js';
import { logError } from '@/utils/logger.js';

export interface TikTokVideo {
  title: string;
  author: string;
  url: string;
}

export class TikTokDownloader extends DownloadService {
  protected getDownloadPrefix(): string {
    return 'TikTok';
  }

  isValidUrl(url: string): boolean {
    return /tiktok\.com\//i.test(url) || /vm\.tiktok\.com\//i.test(url);
  }

  async getVideoInfo(url: string): Promise<TikTokVideo | null> {
    try {
      const output = await this.runCommand(
        'yt-dlp',
        ['--dump-json', '--no-download', '--no-playlist', '--quiet', url],
        30000,
      );
      const info = JSON.parse(output.trim().split('\n')[0]);
      return {
        title: info.title ?? 'TikTok video',
        author: info.uploader ?? info.creator ?? 'unknown',
        url,
      };
    } catch (error) {
      logError('TikTok getVideoInfo', error);
      return null;
    }
  }

  async downloadVideo(url: string): Promise<DownloadResult> {
    const validation = this.validateUrl(url);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const outputPath = this.generateOutputPath('tiktok', 'mp4');

    const methods = [
      {
        name: 'yt-dlp (optimized)',
        cmd: 'yt-dlp',
        args: [
          '-f',
          'best',
          '--no-check-certificate',
          '--no-playlist',
          '--quiet',
          '--newline',
          '-o',
          outputPath,
          url,
        ],
      },
      {
        name: 'yt-dlp (fallback)',
        cmd: 'yt-dlp',
        args: ['--no-check-certificate', '--no-playlist', '-o', outputPath, url],
      },
    ];

    return await this.tryDownloadMethods(methods, outputPath, 'video');
  }

  async downloadAudio(url: string): Promise<DownloadResult> {
    const validation = this.validateUrl(url);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const outputPath = this.generateOutputPath('tiktok_audio', 'mp3');

    const methods = [
      {
        name: 'yt-dlp audio (optimized)',
        cmd: 'yt-dlp',
        args: [
          '-x',
          '--audio-format',
          'mp3',
          '--audio-quality',
          '5',
          '--no-check-certificate',
          '--no-playlist',
          '--quiet',
          '-o',
          outputPath,
          url,
        ],
      },
      {
        name: 'yt-dlp audio (standard)',
        cmd: 'yt-dlp',
        args: [
          '-x',
          '--audio-format',
          'mp3',
          '--audio-quality',
          '0',
          '--no-check-certificate',
          '--no-playlist',
          '-o',
          outputPath,
          url,
        ],
      },
    ];

    return await this.tryDownloadMethods(methods, outputPath, 'audio');
  }
}
