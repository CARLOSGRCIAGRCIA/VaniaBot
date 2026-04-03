/**
 * @fileoverview MegaDownloader.ts - Download files from Mega.nz
 *
 * Downloads files from Mega.nz using the megajs package.
 *
 * @module services/download/MegaDownloader
 */

import { File } from 'megajs';
import { logger } from '@/utils/logger.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const TMP_DIR = path.join(os.tmpdir(), 'vaniabot-mega');

export interface MegaDownloadResult {
  ok: boolean;
  name?: string;
  size?: number;
  filePath?: string;
  error?: string;
}

export class MegaDownloader {
  private ensureTmpDir(): void {
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true });
    }
  }

  async getInfo(url: string): Promise<{ name: string; size: number } | null> {
    return new Promise(resolve => {
      try {
        const file = File.fromURL(url);
        void file.loadAttributes(err => {
          if (err) {
            resolve(null);
            return;
          }
          resolve({
            name: file.name || 'mega-file',
            size: file.size || 0,
          });
        });
      } catch {
        resolve(null);
      }
    });
  }

  async download(url: string): Promise<MegaDownloadResult> {
    return new Promise(resolve => {
      try {
        this.ensureTmpDir();

        const file = File.fromURL(url);
        void file.loadAttributes(async err => {
          if (err) {
            resolve({ ok: false, error: 'Error al obtener info del archivo' });
            return;
          }

          const name = file.name || 'mega-file.mp4';
          const tempPath = path.join(TMP_DIR, `${Date.now()}-${name}`);

          try {
            const data = await file.downloadBuffer({});
            fs.writeFileSync(tempPath, data);

            resolve({
              ok: true,
              name,
              size: data.length,
              filePath: tempPath,
            });
          } catch (downloadErr) {
            logger.error('Mega download error:', downloadErr);
            resolve({ ok: false, error: 'Error al descargar archivo' });
          }
        });
      } catch (error) {
        logger.error('MegaDownloader.download error:', error);
        resolve({ ok: false, error: 'Error al descargar de Mega.nz' });
      }
    });
  }

  cleanup(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {}
  }
}

export const megaDownloader = new MegaDownloader();
