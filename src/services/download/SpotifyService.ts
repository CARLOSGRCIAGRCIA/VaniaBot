/**
 * @fileoverview SpotifyService.ts - Spotify search and download via dvyer-api
 *
 * Downloads music from Spotify using the dvyer-api service.
 * Supports both search queries and direct Spotify URLs.
 *
 * @module services/download/SpotifyService
 */

import axios from 'axios';
import { logger } from '@/utils/logger.js';

const DVYER_API = 'https://dv-yer-api.online';
const DEFAULT_TIMEOUT = 30000;

export interface SpotifyTrack {
  title: string;
  artist: string;
  album: string;
  duration: string;
  thumbnail?: string;
  url: string;
}

export interface SpotifyResult {
  ok: boolean;
  query?: string;
  count?: number;
  results?: SpotifyTrack[];
  download_url?: string;
  title?: string;
  error?: string;
}

export class SpotifyService {
  private async fetchJson<T>(url: string, timeout = DEFAULT_TIMEOUT): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await axios.get<T>(url, {
        signal: controller.signal,
        timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      return response.data;
    } finally {
      clearTimeout(timer);
    }
  }

  async search(query: string, limit = 10): Promise<SpotifyResult> {
    try {
      const url = `${DVYER_API}/spotify?mode=link&q=${encodeURIComponent(query)}&limit=${limit}&lang=es3`;
      const data = await this.fetchJson<SpotifyResult>(url);
      return data;
    } catch (error) {
      logger.error('SpotifyService.search error:', error);
      return { ok: false, error: 'Error al buscar en Spotify' };
    }
  }

  async getDownloadUrl(spotifyUrl: string): Promise<SpotifyResult> {
    try {
      const url = `${DVYER_API}/spotify?mode=link&q=${encodeURIComponent(spotifyUrl)}&pick=1&lang=es3`;
      const data = await this.fetchJson<SpotifyResult>(url);
      return data;
    } catch (error) {
      logger.error('SpotifyService.getDownloadUrl error:', error);
      return { ok: false, error: 'Error al obtener URL de descarga' };
    }
  }

  async getTrackInfo(query: string): Promise<SpotifyResult> {
    return this.search(query, 1);
  }
}

export const spotifyService = new SpotifyService();
