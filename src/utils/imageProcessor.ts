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
  private static resvgAvailable: boolean | null = null;
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
      logger.warn('[ImageProcessor] Sharp not available, using Jimp/resvg fallback');
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
   * Convierte contenido SVG a un Buffer PNG.
   * Estrategia:
   *   1. @resvg/resvg-js  — WASM puro, funciona en Termux sin dependencias nativas
   *   2. @napi-rs/canvas  — si está instalado
   */
  static async svgToBuffer(svgContent: string, width: number, height: number): Promise<Buffer> {
    // 1. resvg-js (WASM, sin bindings nativos, funciona en Termux)
    try {
      const { Resvg } = await import('@resvg/resvg-js');
      const resvg = new Resvg(svgContent, {
        fitTo: { mode: 'width', value: width },
      });
      const pngData = resvg.render();
      return Buffer.from(pngData.asPng());
    } catch (err) {
      logger.warn('[ImageProcessor] resvg-js failed:', err);
    }

    // 2. @napi-rs/canvas
    try {
      return await this.svgToBufferCanvas(svgContent, width, height);
    } catch (err) {
      logger.warn('[ImageProcessor] canvas SVG render failed:', err);
    }

    throw new Error('No SVG renderer available (install @resvg/resvg-js)');
  }

  private static async svgToBufferCanvas(
    svgContent: string,
    width: number,
    height: number,
  ): Promise<Buffer> {
    const { createCanvas, loadImage } = await import('@napi-rs/canvas');
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

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

  /**
   * Compone texto SVG sobre una imagen base.
   *
   * Estrategia (sin sharp):
   *   1. resvg-js → PNG overlay + Jimp composite  (Termux friendly)
   *   2. @napi-rs/canvas
   *   3. Imagen base sin texto (degradación graciosa)
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
    try {
      const svgBuffer = Buffer.from(svgContent);
      const pngFromSvg = await sharp(svgBuffer).png().toBuffer();
      const result = await sharp(imagePath)
        .composite([{ input: pngFromSvg, top: 0, left: 0 }])
        .png()
        .toBuffer();
      return result;
    } catch (err) {
      logger.error('[ImageProcessor] Sharp composite error:', err);
      throw err;
    }
  }

  private static async compositeTextFallback(
    imagePath: string,
    svgContent: string,
    width: number,
    height: number,
  ): Promise<Buffer> {
    // Estrategia 1: resvg-js rasteriza el SVG, Jimp hace el composite
    // No necesita FFmpeg con librsvg. Funciona en Termux.
    try {
      const svgBuffer = await this.svgToBuffer(svgContent, width, height);
      const base = await Jimp.read(imagePath);
      const overlay = await Jimp.read(svgBuffer);
      base.composite(overlay, 0, 0);
      return await base.getBuffer('image/png');
    } catch (err) {
      logger.warn('[ImageProcessor] resvg+Jimp composite failed:', err);
    }

    // Estrategia 2: @napi-rs/canvas (parseo manual del SVG)
    try {
      const buf = await this.compositeTextCanvas(imagePath, svgContent, width, height);
      return buf;
    } catch {
      logger.warn('[ImageProcessor] Canvas fallback falló, devolviendo imagen base');
    }

    // Estrategia 3: imagen base sin texto
    const image = await Jimp.read(imagePath);
    return await image.getBuffer('image/png');
  }

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