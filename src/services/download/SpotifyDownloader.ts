import { Either, left, right } from '@/utils/either.js';
import { DownloadService, type DownloadResult } from './DownloadService.js';
import { logError } from '@/utils/logger.js';
import { NetworkError } from '@/utils/errors.js';

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

  async getTrackInfo(url: string): Promise<Either<NetworkError, SpotifyTrack>> {
    try {
      const output = await this.runCommand(
        'yt-dlp',
        ['--dump-json', '--no-download', '--quiet', url],
        30000,
      );
      const info = JSON.parse(output.trim().split('\n')[0]);
      return right({
        title: info.title ?? 'Spotify track',
        artist: info.artist ?? info.album_artist ?? 'unknown',
        album: info.album ?? 'unknown',
        url,
      });
    } catch (error) {
      logError('Spotify getTrackInfo', error);
      return left(
        new NetworkError('Error al obtener info de Spotify', {
          originalError: error instanceof Error ? error.message : String(error),
        }),
      );
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
          '--quiet',
          `${query} audio`,
        ],
        30000,
      );

      if (!searchOutput || searchOutput.trim() === '') {
        return left(new NetworkError('No se encontró la canción', { query }));
      }

      const lines = searchOutput.trim().split('\n');
      const info = JSON.parse(lines[0]);
      const videoId = info.id;
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

      if (!videoId) {
        logError('Spotify searchAndDownload: videoId is undefined', searchOutput);
        return left(
          new NetworkError('No se pudo obtener el video', {
            response: searchOutput.substring(0, 200),
          }),
        );
      }

      return await this.downloadFromYouTube(videoUrl, query);
    } catch (error) {
      logError('Spotify searchAndDownload', error);
      return left(
        new NetworkError('Error al buscar la canción', {
          originalError: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  async downloadTrack(url: string): Promise<DownloadResult> {
    const validation = this.validateUrl(url);
    if (validation._tag === 'Left') {
      return left(validation.left);
    }

    try {
      const infoOutput = await this.runCommand(
        'yt-dlp',
        ['--dump-json', '--no-download', '--quiet', url],
        30000,
      );

      if (!infoOutput || infoOutput.trim() === '') {
        return left(new NetworkError('No se pudo obtener info de la URL'));
      }

      const info = JSON.parse(infoOutput.trim());
      const title = info.title || 'spotify_track';

      return await this.downloadFromYouTube(url, title);
    } catch (error) {
      logError('Spotify downloadTrack', error);
      return left(
        new NetworkError(
          'Error al procesar URL de Spotify. Prueba buscando por nombre de canción.',
          { originalError: error instanceof Error ? error.message : String(error) },
        ),
      );
    }
  }

  private async downloadFromYouTube(videoUrl: string, title: string): Promise<DownloadResult> {
    const outputPath = this.generateOutputPath(title.replace(/[^a-zA-Z0-9]/g, '_'), 'mp3');

    const methods = [
      {
        name: 'yt-dlp spotify',
        cmd: 'yt-dlp',
        args: [
          '--extractor-args',
          'youtube:player_client=android',
          '-x',
          '--audio-format',
          'mp3',
          '--audio-quality',
          '5',
          '--concurrent-fragments',
          '8',
          '--buffer-size',
          '16M',
          '--no-check-certificate',
          '--quiet',
          '--no-warnings',
          '-o',
          outputPath,
          videoUrl,
        ],
      },
      {
        name: 'yt-dlp spotify fast',
        cmd: 'yt-dlp',
        args: [
          '--extractor-args',
          'youtube:player_client=android',
          '-x',
          '--audio-format',
          'mp3',
          '--audio-quality',
          '8',
          '--no-check-certificate',
          '-o',
          outputPath,
          videoUrl,
        ],
      },
    ];

    return await this.tryDownloadMethods(methods, outputPath, 'audio');
  }
}
