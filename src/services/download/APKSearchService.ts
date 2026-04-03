/**
 * @fileoverview APKSearchService.ts - Search Android apps via dvyer-api
 *
 * Searches for Android applications using the dvyer-api service.
 *
 * @module services/download/APKSearchService
 */

import axios from 'axios';
import { logger } from '@/utils/logger.js';

const DVYER_API = 'https://dv-yer-api.online';
const DEFAULT_TIMEOUT = 30000;

export interface APKApp {
  name: string;
  package?: string;
  developer?: string;
  version?: string;
  size?: string;
  icon?: string;
  download?: string;
}

export interface APKSearchResponse {
  ok: boolean;
  count?: number;
  results?: APKApp[];
  error?: string;
}

export class APKSearchService {
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

  async search(query: string, limit = 5, lang = 'es'): Promise<APKSearchResponse> {
    try {
      const url = `${DVYER_API}/apksearch?q=${encodeURIComponent(query)}&limit=${limit}&lang=${lang}`;
      const data = await this.fetchJson<APKSearchResponse>(url);
      return data;
    } catch (error) {
      logger.error('APKSearchService.search error:', error);
      return { ok: false, error: 'Error al buscar APK' };
    }
  }

  formatResults(results: APKApp[], query: string): string {
    if (!results || results.length === 0) {
      return `No se encontraron apps para: *${query}*\n\n_Usa: !apk <nombre de app>_`;
    }

    let text = `📱 *Resultados APK para:* ${query}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    results.forEach((app, index) => {
      text += `📦 *${index + 1}.* ${app.name}\n`;
      if (app.developer) text += `   👤 ${app.developer}\n`;
      if (app.version) text += `   📌 Versión: ${app.version}\n`;
      if (app.size) text += `   💾 Tamaño: ${app.size}\n`;
      text += '\n';
    });

    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `✦ Usa *!apkdl <nombre>* para descargar`;

    return text;
  }
}

export const apkSearchService = new APKSearchService();
