import { Jimp } from 'jimp';
import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { logger } from '@/utils/logger.js';

export interface ImageProcessorResult {
  buffer: Buffer;
  width: number;
  height: number;
}

export class ImageProcessor {
  private static sharpAvailable: boolean | null = null;
  private static readonly TEMP_DIR = './data/temp';

  static async isSharpAvailable(): Promise<boolean> {
    if (this.sharpAvailable !== null) return this.sharpAvailable;
    try {
      const sharp = (await import('sharp')).default;
      await sharp({
        create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      })
        .png()
        .toBuffer();
      this.sharpAvailable = true;
    } catch {
      this.sharpAvailable = false;
      logger.warn('[ImageProcessor] Sharp not available, using Jimp/FFmpeg fallback');
    }
    return this.sharpAvailable;
  }

  static async loadImage(imagePath: string): Promise<ImageProcessorResult> {
    const useSharp = await this.isSharpAvailable();
    if (useSharp) {
      return await this.loadImageSharp(imagePath);
    }
    return await this.loadImageJimp(imagePath);
  }

  private static async loadImageSharp(imagePath: string): Promise<ImageProcessorResult> {
    const sharp = (await import('sharp')).default;
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    const width = metadata.width || 512;
    const height = metadata.height || 512;
    const buffer = await sharp(imagePath).png().toBuffer();
    return { buffer, width, height };
  }

  private static async loadImageJimp(imagePath: string): Promise<ImageProcessorResult> {
    const image = await Jimp.read(imagePath);
    const width = image.width;
    const height = image.height;
    const buffer = await image.getBuffer('image/png');
    return { buffer, width, height };
  }

  /**
   * Compone texto SVG sobre una imagen base.
   *
   * Estrategia de fallback (sin sharp):
   *   1. FFmpeg overlay con librsvg  — funciona en Termux con `pkg install ffmpeg`
   *   2. @napi-rs/canvas              — si está instalado (`npm i @napi-rs/canvas`)
   *   3. Imagen base sin texto        — degradación graciosa, el comando no muere
   */
  static async compositeText(
    imagePath: string,
    svgContent: string,
    width: number,
    height: number,
  ): Promise<Buffer> {
    const useSharp = await this.isSharpAvailable();
    if (useSharp) {
      return await this.compositeTextSharp(imagePath, svgContent);
    }
    return await this.compositeTextFallback(imagePath, svgContent, width, height);
  }

  private static async compositeTextSharp(imagePath: string, svgContent: string): Promise<Buffer> {
    const sharp = (await import('sharp')).default;
    return await sharp(imagePath)
      .composite([{ input: Buffer.from(svgContent), top: 0, left: 0 }])
      .png()
      .toBuffer();
  }

  private static async compositeTextFallback(
    imagePath: string,
    svgContent: string,
    width: number,
    height: number,
  ): Promise<Buffer> {
    if (!existsSync(this.TEMP_DIR)) {
      mkdirSync(this.TEMP_DIR, { recursive: true });
    }

    const ts = Date.now();
    const svgPath = join(this.TEMP_DIR, `overlay-${ts}.svg`);
    const outPath = join(this.TEMP_DIR, `composite-${ts}.png`);

    const fullSvg = svgContent.includes('xmlns')
      ? svgContent
      : svgContent.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');

    writeFileSync(svgPath, fullSvg, 'utf8');

    try {
      await this.ffmpegOverlay(imagePath, svgPath, outPath, width, height);
      const result = readFileSync(outPath);
      this.cleanup(svgPath, outPath);
      return result;
    } catch (err) {
      logger.warn('[ImageProcessor] FFmpeg overlay falló:', err);
      this.cleanup(svgPath, outPath);
    }

    try {
      const buf = await this.compositeTextCanvas(imagePath, svgContent, width, height);
      this.cleanup(svgPath);
      return buf;
    } catch {
      logger.warn('[ImageProcessor] Canvas fallback falló, devolviendo imagen base');
      this.cleanup(svgPath);
    }

    const image = await Jimp.read(imagePath);
    return await image.getBuffer('image/png');
  }

  /**
   * FFmpeg overlay via librsvg.
   * En Termux: pkg install ffmpeg  (ya incluye librsvg desde ~2023)
   */
  private static ffmpegOverlay(
    baseImage: string,
    svgPath: string,
    output: string,
    width: number,
    height: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-y',
        '-i',
        baseImage,
        '-i',
        svgPath,
        '-filter_complex',
        `[1:v]scale=${width}:${height}[ovr];[0:v][ovr]overlay=0:0`,
        '-frames:v',
        '1',
        output,
      ];
      const proc = spawn('ffmpeg', args);
      let stderr = '';
      proc.stderr.on('data', d => (stderr += d.toString()));
      proc.on('close', code =>
        code === 0
          ? resolve()
          : reject(new Error(`FFmpeg overlay exit ${code}: ${stderr.slice(-400)}`)),
      );
      proc.on('error', reject);
    });
  }

  /**
   * Fallback con @napi-rs/canvas.
   * Parsea los <text> del SVG y los dibuja manualmente sobre la imagen base.
   * Instalar: npm install @napi-rs/canvas
   */
  private static async compositeTextCanvas(
    imagePath: string,
    svgContent: string,
    width: number,
    height: number,
  ): Promise<Buffer> {
    const { createCanvas, loadImage } = await import('@napi-rs/canvas');
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const base = await loadImage(imagePath);
    ctx.drawImage(base, 0, 0, width, height);

    const textBlocks = [...svgContent.matchAll(/<text([^>]*)>([\s\S]*?)<\/text>/gi)];
    for (const [, attrs, rawContent] of textBlocks) {
      const content = rawContent
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");

      const x = parseFloat(attrs.match(/\bx="([\d.]+)"/)?.[1] ?? '0');
      const y = parseFloat(attrs.match(/\by="([\d.]+)"/)?.[1] ?? '0');
      const fontSize = attrs.match(/font-size="(\d+)"/)?.[1] ?? '40';
      const fill = attrs.match(/fill="([^"]+)"/)?.[1] ?? '#ffffff';
      const fontFamily = (attrs.match(/font-family="([^"]+)"/)?.[1] ?? 'Arial')
        .split(',')[0]
        .trim()
        .replace(/['"]/g, '');
      const fontWeight = attrs.match(/font-weight="([^"]+)"/)?.[1] ?? 'normal';
      const anchor = (attrs.match(/text-anchor="([^"]+)"/)?.[1] ?? 'start') as
        | 'start'
        | 'end'
        | 'left'
        | 'right'
        | 'center';

      ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}", Arial`;
      ctx.fillStyle = fill;
      ctx.textAlign = anchor;
      ctx.fillText(content.trim(), x, y);
    }

    return canvas.toBuffer('image/png');
  }

  static async resizeImage(buffer: Buffer, width: number, height: number): Promise<Buffer> {
    const useSharp = await this.isSharpAvailable();
    if (useSharp) {
      return await this.resizeImageSharp(buffer, width, height);
    }
    return await this.resizeImageJimp(buffer, width, height);
  }

  private static async resizeImageSharp(
    buffer: Buffer,
    width: number,
    height: number,
  ): Promise<Buffer> {
    const sharp = (await import('sharp')).default;
    return await sharp(buffer)
      .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  }

  private static async resizeImageJimp(
    buffer: Buffer,
    width: number,
    height: number,
  ): Promise<Buffer> {
    const image = await Jimp.read(buffer);
    image.cover({ w: width, h: height });
    return await image.getBuffer('image/png');
  }

  private static cleanup(...files: string[]): void {
    files.forEach(f => {
      try {
        if (existsSync(f)) unlinkSync(f);
      } catch {}
    });
  }
}
