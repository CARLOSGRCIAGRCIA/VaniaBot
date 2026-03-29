import type { DownloadResult } from './DownloadService.js';
import { DownloadService } from './DownloadService.js';
import { searchVideo, type YouTubeVideo } from './YouTubeSearchService.js';

export type { YouTubeVideo };

export class YouTubeDownloader extends DownloadService {
  protected getDownloadPrefix(): string {
    return 'YouTube';
  }

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
    return await searchVideo(query);
  }

  async downloadAudio(videoId: string): Promise<DownloadResult> {
    const outputPath = this.generateOutputPath(videoId, 'mp3');

    const methods = [
      {
        name: 'yt-dlp audio',
        cmd: 'yt-dlp',
        args: [
          '-x',
          '--audio-format',
          'mp3',
          '--audio-quality',
          '5',
          '--concurrent-fragments',
          '8',
          '--buffer-size',
          '16M',
          '--no-playlist',
          '--no-check-certificate',
          '--quiet',
          '--no-warnings',
          '-o',
          outputPath,
          `https://youtu.be/${videoId}`,
        ],
      },
      {
        name: 'yt-dlp audio fast',
        cmd: 'yt-dlp',
        args: [
          '-x',
          '--audio-format',
          'mp3',
          '--audio-quality',
          '8',
          '--no-playlist',
          '--no-check-certificate',
          '-o',
          outputPath,
          `https://youtu.be/${videoId}`,
        ],
      },
    ];

    return await this.tryDownloadMethods(methods, outputPath, 'audio');
  }

  async downloadVideo(videoId: string): Promise<DownloadResult> {
    const outputPath = this.generateOutputPath(videoId, 'mp4');

    const methods = [
      {
        name: 'yt-dlp video fast',
        cmd: 'yt-dlp',
        args: [
          '-f',
          '18/best',
          '--concurrent-fragments',
          '8',
          '--buffer-size',
          '32M',
          '--hls-prefer-ffmpeg',
          '--no-playlist',
          '--no-check-certificate',
          '--quiet',
          '--no-warnings',
          '-o',
          outputPath,
          `https://youtu.be/${videoId}`,
        ],
      },
      {
        name: 'yt-dlp video',
        cmd: 'yt-dlp',
        args: [
          '-f',
          'best[height<=720]/best',
          '--no-playlist',
          '--no-check-certificate',
          '-o',
          outputPath,
          `https://youtu.be/${videoId}`,
        ],
      },
    ];

    return await this.tryDownloadMethods(methods, outputPath, 'video');
  }
}
