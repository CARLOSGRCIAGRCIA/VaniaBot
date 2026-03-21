import {
  circuitBreakerManager,
  CircuitOpenError,
} from '@/services/system/CircuitBreakerService.js';
import { retryManager } from '@/services/system/RetryService.js';
import { logError, logger } from '@/utils/logger.js';

export interface YouTubeVideo {
  videoId: string;
  title: string;
  duration: string;
  thumbnail: string;
  url: string;
}

interface InvidiousVideo {
  videoId: string;
  title: string;
  timestamp?: string;
  thumbnail?: string;
  url?: string;
  lengthSeconds?: string;
}

const INVIDIOUS_INSTANCES = [
  'https://invidious.nerdvpn.de',
  'https://invidious.protokolla.fi',
  'https://invidious.lunar.icu',
];

async function getWorkingInstance(): Promise<string> {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const response = await fetch(`${instance}/api/v1/trending`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) return instance;
    } catch {
      continue;
    }
  }
  return INVIDIOUS_INSTANCES[0];
}

let cachedInstance: string | null = null;

async function searchYouTube(query: string): Promise<InvidiousVideo[]> {
  if (!cachedInstance) {
    cachedInstance = await getWorkingInstance();
  }

  const url = `${cachedInstance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    cachedInstance = null;
    throw new Error(`Invidious API error: ${response.status}`);
  }

  const data = await response.json();
  return data as InvidiousVideo[];
}

async function getVideoInfo(videoId: string): Promise<InvidiousVideo> {
  if (!cachedInstance) {
    cachedInstance = await getWorkingInstance();
  }

  const url = `${cachedInstance}/api/v1/videos/${videoId}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    cachedInstance = null;
    throw new Error(`Invidious API error: ${response.status}`);
  }

  const data = await response.json();
  return data as InvidiousVideo;
}

export async function searchVideo(query: string): Promise<YouTubeVideo | null> {
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
            const videoId = extractVideoId(query);
            if (!videoId) return null;

            const video = await getVideoInfo(videoId);

            return {
              videoId: video.videoId,
              title: video.title,
              duration: video.lengthSeconds
                ? formatDuration(parseInt(video.lengthSeconds))
                : '0:00',
              thumbnail: video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
              url: `https://youtu.be/${video.videoId}`,
            };
          }

          const results = await searchYouTube(query);

          if (!results.length) return null;

          const video = results[0];
          return {
            videoId: video.videoId,
            title: video.title,
            duration: video.timestamp || '0:00',
            thumbnail: video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
            url: `https://youtu.be/${video.videoId}`,
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
      logError('YouTube search failed', result.error);
      return null;
    }

    return result.result;
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      logger.warn('YouTube search circuit open');
      return null;
    }
    logError('YouTube search', error);
    return null;
  }
}

function extractVideoId(url: string): string | null {
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

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
