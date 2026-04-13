import { logError } from '@/utils/logger.js';

const BASE_URL = 'https://api.delirius.store/canvas';
const TIMEOUT_MS = 30000;

export class CanvasService {
  async getImage(endpoint: string, params?: Record<string, string>): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      let url = `${BASE_URL}/${endpoint}`;
      if (params) {
        const searchParams = new URLSearchParams(params);
        url += `?${searchParams.toString()}`;
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Canvas Error: ${response.status}`);
      }

      const data = (await response.json()) as { result?: string; image?: string; url?: string };

      if (data.result) return data.result;
      if (data.image) return data.image;
      if (data.url) return data.url;

      throw new Error('No image URL in response');
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const canvasService = new CanvasService();
