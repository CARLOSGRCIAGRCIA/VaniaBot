import { parentPort } from 'worker_threads';
import { YouTubeDownloader } from '../services/download/YouTubeDownloader.js';
import { TikTokDownloader } from '../services/download/TikTokDownloader.js';
import { InstagramDownloader } from '../services/download/InstagramDownloader.js';
import { TwitterDownloader } from '../services/download/TwitterDownloader.js';
import { FacebookDownloader } from '../services/download/FacebookDownloader.js';
import { SpotifyDownloader } from '../services/download/SpotifyDownloader.js';

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

async function processDownload(task: DownloadTask): Promise<DownloadResult> {
  try {
    switch (task.type) {
      case 'youtube-audio': {
        const videoId = downloaders.youtube.extractVideoId(task.url);
        if (!videoId) {
          return { success: false, error: 'Invalid YouTube URL' };
        }
        return await downloaders.youtube.downloadAudio(videoId);
      }

      case 'youtube-video': {
        const videoId = downloaders.youtube.extractVideoId(task.url);
        if (!videoId) {
          return { success: false, error: 'Invalid YouTube URL' };
        }
        return await downloaders.youtube.downloadVideo(videoId);
      }

      case 'tiktok-video':
        return await downloaders.tiktok.downloadVideo(task.url);

      case 'tiktok-audio':
        return await downloaders.tiktok.downloadAudio(task.url);

      case 'instagram':
        return await downloaders.instagram.downloadVideo(task.url);

      case 'twitter':
        return await downloaders.twitter.downloadVideo(task.url);

      case 'facebook':
        return await downloaders.facebook.downloadVideo(task.url);

      case 'spotify':
        return await downloaders.spotify.downloadTrack(task.url);

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
