import type { DownloadResult } from './DownloadService.js';
import { DownloadService } from './DownloadService.js';
import { logError } from '@/utils/logger.js';

export interface SpotifyTrack {
  title: string;
  artist: string;
  album: string;
  url: string;
}

export class SpotifyDownloader extends DownloadService {
  protected getDownloadPrefix(): string {
    return 'Spotify';
  }

  isValidUrl(url: string): boolean {
    return /spotify\.com\//i.test(url);
  }

  async getTrackInfo(url: string): Promise<SpotifyTrack | null> {
    try {
      const output = await this.runCommand('yt-dlp', ['--dump-json', '--no-download', url], 30000);
      const info = JSON.parse(output.trim().split('\n')[0]);
      return {
        title: info.title ?? 'Spotify track',
        artist: info.artist ?? info.album_artist ?? 'unknown',
        album: info.album ?? 'unknown',
        url,
      };
    } catch (error) {
      logError('Spotify getTrackInfo', error);
      return null;
    }
  }

  async searchAndDownload(query: string): Promise<DownloadResult> {
    try {
      const searchOutput = await this.runCommand(
        'yt-dlp',
        ['--default-search', 'ytsearch1', '--dump-json', '--no-download', `${query} audio`],
        30000,
      );

      if (!searchOutput || searchOutput.trim() === '') {
        return { success: false, error: 'No se encontró la canción' };
      }

      const info = JSON.parse(searchOutput.trim());
      const videoUrl = info.url;

      const outputPath = this.generateOutputPath(query.replace(/[^a-zA-Z0-9]/g, '_'), 'mp3');

      const methods = [
        {
          name: 'yt-dlp download',
          cmd: 'yt-dlp',
          args: [
            '-x',
            '--audio-format',
            'mp3',
            '--audio-quality',
            '0',
            '--no-check-certificate',
            '--extract-audio',
            '-o',
            outputPath,
            videoUrl,
          ],
        },
      ];

      return await this.tryDownloadMethods(methods, outputPath, 'audio');
    } catch (error) {
      logError('Spotify searchAndDownload', error);
      return { success: false, error: 'Error al buscar la canción' };
    }
  }

  async downloadTrack(url: string): Promise<DownloadResult> {
    const validation = this.validateUrl(url);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const outputPath = this.generateOutputPath('spotify', 'mp3');

    const methods = [
      {
        name: 'spotify-dl',
        cmd: 'spotifydl',
        args: ['-o', outputPath.replace('.mp3', ''), url],
      },
      {
        name: 'yt-dlp fallback',
        cmd: 'yt-dlp',
        args: [
          '-x',
          '--audio-format',
          'mp3',
          '--audio-quality',
          '0',
          '--no-check-certificate',
          '--extract-audio',
          '-o',
          outputPath,
          url,
        ],
      },
    ];

    return await this.tryDownloadMethods(methods, outputPath, 'audio');
  }
}
