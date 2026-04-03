/**
 * @fileoverview PinterestDownloader.ts - Download from Pinterest
 *
 * Downloads images and videos from Pinterest.
 *
 * @module services/download/PinterestDownloader
 */

import axios from 'axios';
import { logger } from '@/utils/logger.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import cheerio from 'cheerio';

const TMP_DIR = path.join(os.tmpdir(), 'vaniabot-pinterest');

export interface PinterestMedia {
  type: 'image' | 'video';
  url: string;
  thumbnail?: string;
}

export interface PinterestResult {
  ok: boolean;
  media?: PinterestMedia[];
  error?: string;
}

export class PinterestDownloader {
  private ensureTmpDir(): void {
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true });
    }
  }

  async getMedia(url: string): Promise<PinterestResult> {
    try {
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });

      const $ = cheerio.load(response.data);
      const media: PinterestMedia[] = [];

      $('img[srcset]').each((_, el) => {
        const srcset = $(el).attr('srcset');
        if (srcset) {
          const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
          const bestUrl = urls[urls.length - 1];
          if (bestUrl && bestUrl.includes('pinterest')) {
            media.push({
              type: 'image',
              url: bestUrl.replace(/\/[^/]+\/\d+x\d+\//, '/Originals/'),
            });
          }
        }
      });

      $('video source').each((_, el) => {
        const src = $(el).attr('src');
        if (src) {
          media.push({
            type: 'video',
            url: src,
          });
        }
      });

      const jsonData =
        $('script[data-test-id="pin-closeup"]').html() ||
        $('script[type="application/ld+json"]').html();
      if (jsonData) {
        try {
          const data = JSON.parse(jsonData);
          if (data?.image) {
            const imgUrl = typeof data.image === 'string' ? data.image : data.image?.[0];
            if (imgUrl) {
              media.unshift({ type: 'image', url: imgUrl });
            }
          }
          if (data?.video?.contentUrl) {
            const vidUrl =
              typeof data.video.contentUrl === 'string'
                ? data.video.contentUrl
                : data.video?.contentUrl?.[0];
            if (vidUrl) {
              media.unshift({ type: 'video', url: vidUrl });
            }
          }
        } catch {}
      }

      if (media.length === 0) {
        return { ok: false, error: 'No se encontró contenido descargable' };
      }

      return { ok: true, media };
    } catch (error) {
      logger.error('PinterestDownloader.getMedia error:', error);
      return { ok: false, error: 'Error al obtener contenido de Pinterest' };
    }
  }

  async downloadImage(
    imageUrl: string,
  ): Promise<{ ok: boolean; filePath?: string; error?: string }> {
    try {
      this.ensureTmpDir();

      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const ext = imageUrl.includes('.gif') ? 'gif' : 'jpg';
      const tempPath = path.join(TMP_DIR, `${Date.now()}.${ext}`);
      fs.writeFileSync(tempPath, Buffer.from(response.data));

      return { ok: true, filePath: tempPath };
    } catch (error) {
      logger.error('PinterestDownloader.downloadImage error:', error);
      return { ok: false, error: 'Error al descargar imagen' };
    }
  }

  cleanup(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {}
  }
}

export const pinterestDownloader = new PinterestDownloader();
