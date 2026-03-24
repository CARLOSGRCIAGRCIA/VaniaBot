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

// Rastrear instancias que fallaron recientemente
const failedInstances = new Map<string, number>(); // instance -> timestamp del fallo
const INSTANCE_COOLDOWN_MS = 60_000; // 1 minuto de cooldown por instancia

function isInstanceOnCooldown(instance: string): boolean {
  const failedAt = failedInstances.get(instance);
  if (!failedAt) return false;
  if (Date.now() - failedAt > INSTANCE_COOLDOWN_MS) {
    failedInstances.delete(instance);
    return false;
  }
  return true;
}

function markInstanceFailed(instance: string): void {
  failedInstances.set(instance, Date.now());
  logger.warn(`⚠️ Invidious instance marked as failed: ${instance}`);
}

/**
 * Verifica que la instancia responda JSON real, no HTML.
 * El HEAD no es suficiente — hay que verificar el Content-Type del API.
 */
async function isInstanceWorking(instance: string): Promise<boolean> {
  try {
    const response = await fetch(`${instance}/api/v1/trending?type=video&fields=videoId`, {
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) return false;

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return false;

    // Leer un poco para confirmar que es JSON real
    const text = await response.text();
    return text.trim().startsWith('[') || text.trim().startsWith('{');
  } catch {
    return false;
  }
}

async function getWorkingInstance(): Promise<string | null> {
  // Filtrar instancias en cooldown
  const candidates = INVIDIOUS_INSTANCES.filter(i => !isInstanceOnCooldown(i));

  if (candidates.length === 0) {
    logger.warn('All Invidious instances are on cooldown, resetting...');
    failedInstances.clear();
    candidates.push(...INVIDIOUS_INSTANCES);
  }

  for (const instance of candidates) {
    if (await isInstanceWorking(instance)) {
      logger.debug(`✓ Using Invidious instance: ${instance}`);
      return instance;
    }
    markInstanceFailed(instance);
  }

  return null;
}

async function fetchFromInvidious(path: string, expectedStart: '[' | '{'): Promise<unknown> {
  // Nunca usar cache ciego — elegir instancia fresca si la actual falló
  const instance = await getWorkingInstance();

  if (!instance) {
    throw new Error('No Invidious instances available. All are down or rate-limited.');
  }

  const url = `${instance}${path}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    markInstanceFailed(instance);
    throw new Error(`Invidious HTTP ${response.status} from ${instance}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    markInstanceFailed(instance);
    throw new Error(`Invidious returned non-JSON content-type: ${contentType} from ${instance}`);
  }

  const text = await response.text();

  if (!text.trim().startsWith(expectedStart)) {
    markInstanceFailed(instance);
    throw new Error(`Invidious returned unexpected response (expected JSON) from ${instance}`);
  }

  return JSON.parse(text);
}

async function searchYouTube(query: string): Promise<InvidiousVideo[]> {
  const data = await fetchFromInvidious(
    `/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
    '[',
  );
  return data as InvidiousVideo[];
}

async function getVideoInfo(videoId: string): Promise<InvidiousVideo> {
  const data = await fetchFromInvidious(`/api/v1/videos/${videoId}`, '{');
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
          maxAttempts: 3, // +1 intento para dar oportunidad de rotar instancia
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
      logger.warn('YouTube search circuit open — too many failures, cooling down');
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
