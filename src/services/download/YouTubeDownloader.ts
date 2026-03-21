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
}
