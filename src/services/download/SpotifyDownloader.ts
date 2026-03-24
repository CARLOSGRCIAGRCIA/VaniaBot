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
        [
          '--default-search',
          'ytsearch1',
          '--extractor-args',
          'youtube:player_client=android',
          '--dump-json',
          '--no-download',
          `${query} audio`,
        ],
        30000,
      );

      if (!searchOutput || searchOutput.trim() === '') {
        return { success: false, error: 'No se encontró la canción' };
      }

      const lines = searchOutput.trim().split('\n');
      const info = JSON.parse(lines[0]);
      const videoId = info.id;
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

      if (!videoId) {
        logError('Spotify searchAndDownload: videoId is undefined', searchOutput);
        return {
          success: false,
          error: 'No se pudo obtener el video. Respuesta: ' + searchOutput.substring(0, 200),
        };
      }

      return await this.downloadFromYouTube(videoUrl, query);
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

    try {
      const infoOutput = await this.runCommand(
        'yt-dlp',
        ['--dump-json', '--no-download', url],
        30000,
      );

      if (!infoOutput || infoOutput.trim() === '') {
        return { success: false, error: 'No se pudo obtener info de la URL' };
      }

      const info = JSON.parse(infoOutput.trim());
      const title = info.title || 'spotify_track';

      return await this.downloadFromYouTube(url, title);
    } catch (error) {
      logError('Spotify downloadTrack', error);
      return {
        success: false,
        error: 'Error al procesar URL de Spotify. Prueba buscando por nombre de canción.',
      };
    }
  }

  private async downloadFromYouTube(videoUrl: string, title: string): Promise<DownloadResult> {
    const outputPath = this.generateOutputPath(title.replace(/[^a-zA-Z0-9]/g, '_'), 'mp3');

    const methods = [
      {
        name: 'yt-dlp download',
        cmd: 'yt-dlp',
        args: [
          '--extractor-args',
          'youtube:player_client=android',
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
  }
}
