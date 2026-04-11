import { parentPort } from 'worker_threads';
import { YouTubeDownloader } from '../services/download/YouTubeDownloader.js';
import { TikTokDownloader } from '../services/download/TikTokDownloader.js';
import { InstagramDownloader } from '../services/download/InstagramDownloader.js';
import { TwitterDownloader } from '../services/download/TwitterDownloader.js';
import { FacebookDownloader } from '../services/download/FacebookDownloader.js';
import { SpotifyDownloader } from '../services/download/SpotifyDownloader.js';
import { Either, isRight, isLeft } from '../utils/either.js';
import { VBotError } from '../utils/errors.js';

interface DownloadTask {
  id: string;
  type:
    | 'youtube-audio'
    | 'youtube-video'
    | 'tiktok-video'
    | 'tiktok-audio'
    | 'instagram'
    | 'twitter'
    | 'facebook'
    | 'spotify';
  url: string;
  options?: Record<string, unknown>;
}

interface DownloadResult {
  success: boolean;
  filePath?: string;
  size?: string;
  error?: string;
}

interface WorkerMessage {
  type: 'download';
  task: DownloadTask;
}

interface WorkerResponse {
  id: string;
  success: boolean;
  result?: DownloadResult;
  error?: string;
}

const downloaders = {
  youtube: new YouTubeDownloader(),
  tiktok: new TikTokDownloader(),
  instagram: new InstagramDownloader(),
  twitter: new TwitterDownloader(),
  facebook: new FacebookDownloader(),
  spotify: new SpotifyDownloader(),
};

function extractErrorMessage(error: unknown): string {
  if (error instanceof VBotError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function convertToOldResult(
  either: Either<{ message: string }, { filePath: string; size: string; source: string }>,
): DownloadResult {
  if (isLeft(either)) {
    return { success: false, error: extractErrorMessage(either.left) };
  }
  return { success: true, filePath: either.right.filePath, size: either.right.size };
}

async function processDownload(task: DownloadTask): Promise<DownloadResult> {
  try {
    switch (task.type) {
      case 'youtube-audio': {
        const videoId = downloaders.youtube.extractVideoId(task.url);
        if (!videoId) {
          return { success: false, error: 'Invalid YouTube URL' };
        }
        const result = await downloaders.youtube.downloadAudio(videoId);
        return convertToOldResult(result);
      }

      case 'youtube-video': {
        const videoId = downloaders.youtube.extractVideoId(task.url);
        if (!videoId) {
          return { success: false, error: 'Invalid YouTube URL' };
        }
        const result = await downloaders.youtube.downloadVideo(videoId);
        return convertToOldResult(result);
      }

      case 'tiktok-video': {
        const result = await downloaders.tiktok.downloadVideo(task.url);
        return convertToOldResult(result);
      }

      case 'tiktok-audio': {
        const result = await downloaders.tiktok.downloadAudio(task.url);
        return convertToOldResult(result);
      }

      case 'instagram': {
        const result = await downloaders.instagram.downloadVideo(task.url);
        return convertToOldResult(result);
      }

      case 'twitter': {
        const result = await downloaders.twitter.downloadVideo(task.url);
        return convertToOldResult(result);
      }

      case 'facebook': {
        const result = await downloaders.facebook.downloadVideo(task.url);
        return convertToOldResult(result);
      }

      case 'spotify': {
        const result = await downloaders.spotify.downloadTrack(task.url);
        return convertToOldResult(result);
      }

      default:
        return { success: false, error: `Unknown download type: ${task.type}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

parentPort?.on('message', async (message: WorkerMessage) => {
  if (message.type === 'download') {
    const result = await processDownload(message.task);
    parentPort?.postMessage({
      id: message.task.id,
      success: result.success,
      result,
    } as WorkerResponse);
  }
});

parentPort?.postMessage({ type: 'ready' });
