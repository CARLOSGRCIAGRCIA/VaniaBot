import {
  circuitBreakerManager,
  CircuitOpenError,
} from '@/services/system/CircuitBreakerService.js';
import { retryManager } from '@/services/system/RetryService.js';
import { logError, logger } from '@/utils/logger.js';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

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

// Lista ampliada — fuente: https://api.invidious.io/instances.json
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.privacydev.net',
  'https://invidious.fdn.fr',
  'https://iv.datura.network',
  'https://invidious.perennialte.ch',
  'https://invidious.nerdvpn.de',
  'https://invidious.protokolla.fi',
  'https://invidious.lunar.icu',
];

const failedInstances = new Map<string, number>();
const INSTANCE_COOLDOWN_MS = 120_000;

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
  logger.warn(`⚠️ Invidious instance failed: ${instance}`);
}

async function isInstanceWorking(instance: string): Promise<boolean> {
  try {
    const response = await fetch(`${instance}/api/v1/trending?type=video&fields=videoId`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return false;
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return false;
    const text = await response.text();
    return text.trim().startsWith('[') || text.trim().startsWith('{');
  } catch {
    return false;
  }
}

async function getWorkingInstance(): Promise<string | null> {
  const candidates = INVIDIOUS_INSTANCES.filter(i => !isInstanceOnCooldown(i));

  if (candidates.length === 0) {
    logger.warn('All Invidious instances on cooldown — resetting');
    failedInstances.clear();
    candidates.push(...INVIDIOUS_INSTANCES);
  }

  // Probar todas en paralelo, usar la primera que responda
  const results = await Promise.allSettled(
    candidates.map(async instance => {
      const ok = await isInstanceWorking(instance);
      if (!ok) throw new Error('not working');
      return instance;
    }),
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      logger.debug(`✓ Invidious instance OK: ${result.value}`);
      return result.value;
    }
  }

  candidates.forEach(markInstanceFailed);
  return null;
}

async function fetchFromInvidious(path: string, expectedStart: '[' | '{'): Promise<unknown> {
  const instance = await getWorkingInstance();
  if (!instance) throw new Error('No Invidious instances available');

  const url = `${instance}${path}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });

  if (!response.ok) {
    markInstanceFailed(instance);
    throw new Error(`Invidious HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    markInstanceFailed(instance);
    throw new Error(`Invidious returned non-JSON (${contentType})`);
  }

  const text = await response.text();
  if (!text.trim().startsWith(expectedStart)) {
    markInstanceFailed(instance);
    throw new Error('Invidious returned unexpected response format');
  }

  return JSON.parse(text);
}

// Fallback: yt-dlp busca directamente en YouTube sin depender de Invidious
async function searchWithYtDlp(query: string): Promise<YouTubeVideo | null> {
  try {
    logger.debug('[yt-dlp] Usando fallback de búsqueda...');
    const { stdout } = await execFileAsync(
      'yt-dlp',
      ['ytsearch1:' + query, '--dump-json', '--no-playlist', '--skip-download', '--quiet'],
      { timeout: 15000 },
    );

    const data = JSON.parse(stdout.trim());
    return {
      videoId: data.id,
      title: data.title,
      duration: formatDuration(data.duration ?? 0),
      thumbnail: data.thumbnail ?? `https://i.ytimg.com/vi/${data.id}/hqdefault.jpg`,
      url: `https://youtu.be/${data.id}`,
    };
  } catch (error) {
    logError('yt-dlp search fallback', error);
    return null;
  }
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
            try {
              const video = await getVideoInfo(videoId);
              return {
                videoId: video.videoId,
                title: video.title,
                duration: video.lengthSeconds
                  ? formatDuration(parseInt(video.lengthSeconds))
                  : '0:00',
                thumbnail:
                  video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
                url: `https://youtu.be/${video.videoId}`,
              };
            } catch {
              return await searchWithYtDlp(query);
            }
          }

          try {
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
          } catch {
            logger.warn('Invidious falló, usando yt-dlp como fallback');
            return await searchWithYtDlp(query);
          }
        },
        { maxAttempts: 2, baseDelay: 1000, maxDelay: 5000 },
      );
    });

    if (!result.success || !result.result) {
      logError('YouTube search failed', result.error);
      return null;
    }

    return result.result;
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      logger.warn('YouTube search circuit open — intentando yt-dlp directo');
      return await searchWithYtDlp(query);
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
