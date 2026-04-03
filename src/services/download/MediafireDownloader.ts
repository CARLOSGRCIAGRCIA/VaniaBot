/**
 * @fileoverview MediafireDownloader.ts - Download files from Mediafire
 *
 * Downloads files from Mediafire using @bochilteam/scraper-mediafire.
 *
 * @module services/download/MediafireDownloader
 */

import { mediafiredl } from '@bochilteam/scraper-mediafire';
import { logger } from '@/utils/logger.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';

const TMP_DIR = path.join(os.tmpdir(), 'vaniabot-mediafire');

export interface MediafireResult {
  ok: boolean;
  filename?: string;
  size?: string;
  url?: string;
  filePath?: string;
  error?: string;
}

export class MediafireDownloader {
  private ensureTmpDir(): void {
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true });
    }
  }

  async getInfo(url: string): Promise<MediafireResult> {
    try {
      const result = await mediafiredl(url);
      if (!result.filename) {
        return { ok: false, error: 'No se pudo obtener info del archivo' };
      }
      return {
        ok: true,
        filename: result.filename,
        size: result.filesizeH,
        url: result.url,
      };
    } catch (error) {
      logger.error('MediafireDownloader.getInfo error:', error);
      return { ok: false, error: 'Error al obtener info de Mediafire' };
    }
  }

  async download(url: string): Promise<MediafireResult> {
    try {
      this.ensureTmpDir();

      const info = await this.getInfo(url);
      if (!info.ok || !info.url) {
        return info;
      }

      const ext = path.extname(info.filename || 'file');
      const tempPath = path.join(TMP_DIR, `${Date.now()}${ext}`);

      const response = await axios.get(info.url, {
        responseType: 'stream',
        timeout: 120000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const writer = fs.createWriteStream(tempPath);
      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      return {
        ok: true,
        filename: info.filename,
        size: info.size,
        url: info.url,
        filePath: tempPath,
      };
    } catch (error) {
      logger.error('MediafireDownloader.download error:', error);
      return { ok: false, error: 'Error al descargar de Mediafire' };
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

export const mediafireDownloader = new MediafireDownloader();
