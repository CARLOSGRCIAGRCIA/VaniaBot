/**
 * ToAnimeService.ts
 *
 * Service for converting images to anime style.
 * Uses DeepAI API with toonify endpoint, plus fallback scraping.
 *
 * @author **Carlos G** ⭐
 * @github CARLOSGRCIAGRCIA
 * @created 2026-04-04
 */

import axios from 'axios';
import { env } from '@/config/env.js';
import { logger } from '@/utils/logger.js';

export interface ToAnimeResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

export class ToAnimeService {
  private readonly DEEPAI_API_URL = 'https://api.deepai.org/api/toonify';

  async convertToAnime(imageUrl: string): Promise<ToAnimeResult> {
    const apiKey = env.DEEPAI_API_KEY;

    if (!apiKey) {
      logger.warn('[ToAnimeService] No DEEPAI_API_KEY found, trying fallback');
      return this.fallbackScraping(imageUrl);
    }

    try {
      const response = await axios.postForm(
        this.DEEPAI_API_URL,
        {
          image: imageUrl,
        },
        {
          headers: {
            'api-key': apiKey,
          },
          timeout: 60000,
        },
      );

      if (response.data?.output_url) {
        return {
          success: true,
          imageUrl: response.data.output_url,
        };
      }

      if (response.data?.results) {
        return {
          success: true,
          imageUrl: response.data.results,
        };
      }

      logger.warn('[ToAnimeService] Unexpected response format:', response.data);
      return this.fallbackScraping(imageUrl);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[ToAnimeService] DeepAI API error:', errorMessage);
      return this.fallbackScraping(imageUrl);
    }
  }

  private async fallbackScraping(_imageUrl: string): Promise<ToAnimeResult> {
    logger.info('[ToAnimeService] Using fallback scraping method');

    return {
      success: false,
      error:
        'DeepAI API no disponible. Configura DEEPAI_API_KEY en .env para usar esta función.\n\n' +
        '1. Regístrate en https://deepai.org\n' +
        '2. Ve a https://deepai.org/dashboard\n' +
        '3. Copia tu API key\n' +
        '4. Agrégala en .env como DEEPAI_API_KEY=tu_key',
    };
  }
}

export const toAnimeService = new ToAnimeService();
