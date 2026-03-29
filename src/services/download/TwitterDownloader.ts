import type { DownloadResult } from './DownloadService.js';
import { DownloadService } from './DownloadService.js';
import { logError } from '@/utils/logger.js';

export interface TwitterVideo {
  title: string;
  author: string;
  url: string;
}

export class TwitterDownloader extends DownloadService {
  protected getDownloadPrefix(): string {
    return 'Twitter';
  }

  isValidUrl(url: string): boolean {
    return /twitter\.com\//i.test(url) || /x\.com\//i.test(url);
  }

  async getVideoInfo(url: string): Promise<TwitterVideo | null> {
    try {
      const output = await this.runCommand(
        'yt-dlp',
        ['--dump-json', '--no-download', '--no-playlist', '--quiet', url],
        30000,
      );
      const info = JSON.parse(output.trim().split('\n')[0]);
      return {
        title: info.title ?? 'Twitter video',
        author: info.uploader ?? 'unknown',
        url,
      };
    } catch (error) {
      logError('Twitter getVideoInfo', error);
      return null;
    }
  }

  async downloadVideo(url: string): Promise<DownloadResult> {
    const validation = this.validateUrl(url);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const outputPath = this.generateOutputPath('twitter', 'mp4');

    const methods = [
      {
        name: 'yt-dlp (optimized)',
        cmd: 'yt-dlp',
        args: [
          '-f',
          'best[ext=mp4]/best',
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
        name: 'yt-dlp (fast)',
        cmd: 'yt-dlp',
        args: [
          '-f',
          'best[ext=mp4]/best',
          '--no-check-certificate',
          '--no-playlist',
          '-o',
          outputPath,
          url,
        ],
      },
    ];

    return await this.tryDownloadMethods(methods, outputPath, 'video');
  }

  async downloadAudio(url: string): Promise<DownloadResult> {
    const validation = this.validateUrl(url);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const outputPath = this.generateOutputPath('twitter_audio', 'mp3');

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
