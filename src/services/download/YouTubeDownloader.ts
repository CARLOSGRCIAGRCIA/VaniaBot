import type { DownloadResult } from './DownloadService.js';
import { DownloadService } from './DownloadService.js';
import {
  circuitBreakerManager,
  CircuitOpenError,
} from '@/services/system/CircuitBreakerService.js';
import { retryManager } from '@/services/system/RetryService.js';
import { logger, logError } from '@/utils/logger.js';
import yts from 'yt-search';
import fs from 'fs';

export interface YouTubeVideo {
  videoId: string;
  title: string;
  duration: string;
  thumbnail: string;
  url: string;
}

// Tipo para error de comando
interface CommandError extends Error {
  message: string;
}

export class YouTubeDownloader extends DownloadService {
  extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  async searchVideo(query: string): Promise<YouTubeVideo | null> {
    const circuitBreaker = circuitBreakerManager.getOrCreate('youtube-search', {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 15000,
      name: 'youtube-search',
    });

    try {
      const result = await circuitBreaker.execute(async () => {
        return await retryManager.retryOperation(
          'youtube-search',
          async () => {
            if (query.includes('youtube.com') || query.includes('youtu.be')) {
              const videoId = this.extractVideoId(query);
              if (!videoId) return null;

              const options: { videoId: string } = { videoId };
              const ytResult = await yts(options);

              return {
                videoId: ytResult.videoId,
                title: ytResult.title,
                duration: ytResult.timestamp,
                thumbnail: ytResult.thumbnail,
                url: ytResult.url,
              };
            }

            const results = await yts(query);
            if (!results.videos.length) return null;

            const video = results.videos[0];
            return {
              videoId: video.videoId,
              title: video.title,
              duration: video.timestamp,
              thumbnail: video.thumbnail,
              url: video.url,
            };
          },
          {
            maxAttempts: 2,
            baseDelay: 1000,
            maxDelay: 5000,
          },
        );
      });

      if (!result.success || !result.result) {
        console.error('YouTube search failed:', result.error);
        return null;
      }

      return result.result;
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        logger.warn('YouTube search circuit open');
        return null;
      }
      logError('YouTubeDownloader.search', error);
      return null;
    }
  }

  async downloadAudio(videoId: string): Promise<DownloadResult> {
    const outputPath = this.generateOutputPath(videoId, 'mp3');

    const methods = [
      {
        name: 'yt-dlp',
        cmd: 'yt-dlp',
        args: [
          '-x',
          '--audio-format',
          'mp3',
          '--audio-quality',
          '0',
          '-o',
          outputPath,
          `https://youtu.be/${videoId}`,
        ],
      },
      {
        name: 'youtube-dl',
        cmd: 'youtube-dl',
        args: ['-x', '--audio-format', 'mp3', '-o', outputPath, `https://youtu.be/${videoId}`],
      },
    ];

    return await this.tryDownloadMethods(methods, outputPath, 'audio');
  }

  async downloadVideo(videoId: string): Promise<DownloadResult> {
    const outputPath = this.generateOutputPath(videoId, 'mp4');

    const methods = [
      {
        name: 'yt-dlp',
        cmd: 'yt-dlp',
        args: ['-f', 'best[height<=720]', '-o', outputPath, `https://youtu.be/${videoId}`],
      },
      {
        name: 'youtube-dl',
        cmd: 'youtube-dl',
        args: ['-f', 'best[height<=480]', '-o', outputPath, `https://youtu.be/${videoId}`],
      },
    ];

    return await this.tryDownloadMethods(methods, outputPath, 'video');
  }

  private async tryDownloadMethods(
    methods: Array<{ name: string; cmd: string; args: string[] }>,
    outputPath: string,
    type: 'audio' | 'video',
  ): Promise<DownloadResult> {
    for (const method of methods) {
      try {
        logger.debug(`🔄 Trying ${method.name}...`);

        await this.runCommand(method.cmd, method.args, 180000);

        if (fs.existsSync(outputPath)) {
          const sizeCheck = this.checkFileSize(outputPath, type);

          if (!sizeCheck.valid) {
            fs.unlinkSync(outputPath);
            return {
              success: false,
              error: `File too large: ${sizeCheck.sizeMB}MB`,
            };
          }

          logger.debug(`✅ ${method.name} succeeded: ${sizeCheck.sizeMB}MB`);

          return {
            success: true,
            filePath: outputPath,
            size: sizeCheck.sizeMB.toString(),
            source: method.name,
          };
        }
      } catch (error) {
        const commandError = error as CommandError;
        logger.debug(`❌ ${method.name} failed: ${commandError.message}`);
        continue;
      }
    }

    return {
      success: false,
      error: 'Install yt-dlp: sudo apt install yt-dlp ffmpeg',
    };
  }
}
