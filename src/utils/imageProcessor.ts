import { Jimp } from 'jimp';
import { readFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { logger } from '@/utils/logger.js';

export interface ImageProcessorResult {
  buffer: Buffer;
  width: number;
  height: number;
}

interface ParsedTextBlock {
  content: string;
  x: number;
  y: number;
  fontSize: number;
  fill: string;
  fontWeight: string;
  textAnchor: string;
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
      logger.warn('[ImageProcessor] Sharp not available, using FFmpeg drawtext fallback');
    }
    return this.sharpAvailable;
  }

  static async isResvgAvailable(): Promise<boolean> {
    if (this.resvgAvailable !== null) return this.resvgAvailable;
    try {
      await import('@resvg/resvg-js');
      this.resvgAvailable = true;
    } catch {
      this.resvgAvailable = false;
    }
    return this.resvgAvailable;
  }

  static async loadImage(imagePath: string): Promise<ImageProcessorResult> {
    const useSharp = await this.isSharpAvailable();
    if (useSharp) return await this.loadImageSharp(imagePath);
    return await this.loadImageJimp(imagePath);
  }

  private static async loadImageSharp(imagePath: string): Promise<ImageProcessorResult> {
    const sharp = (await import('sharp')).default;
    const metadata = await sharp(imagePath).metadata();
    const width = metadata.width || 512;
    const height = metadata.height || 512;
    const buffer = await sharp(imagePath).png().toBuffer();
    return { buffer, width, height };
  }

  private static async loadImageJimp(imagePath: string): Promise<ImageProcessorResult> {
    const image = await Jimp.read(imagePath);
    return {
      buffer: await image.getBuffer('image/png'),
      width: image.width,
      height: image.height,
    };
  }

  static async svgToBuffer(svgContent: string, width: number, height: number): Promise<Buffer> {
    // 1. resvg-js (WASM puro, funciona en Termux si está instalado)
    if (await this.isResvgAvailable()) {
      try {
        const { Resvg } = await import('@resvg/resvg-js');
        const resvg = new Resvg(svgContent, { fitTo: { mode: 'width', value: width } });
        return Buffer.from(resvg.render().asPng());
      } catch (err) {
        logger.warn('[ImageProcessor] resvg-js failed:', err);
      }
    }

    // 2. @napi-rs/canvas (parseo manual de text blocks)
    try {
      return await this.svgToBufferCanvas(svgContent, width, height);
    } catch (err) {
      logger.warn('[ImageProcessor] canvas SVG render failed:', err);
    }

    throw new Error('No SVG renderer available. Run: npm install @resvg/resvg-js');
  }

  private static async svgToBufferCanvas(
    svgContent: string,
    width: number,
    height: number,
  ): Promise<Buffer> {
    const { createCanvas } = await import('@napi-rs/canvas');
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const blocks = this.parseSvgTextBlocks(svgContent);
    for (const b of blocks) {
      ctx.font = `${b.fontWeight} ${b.fontSize}px Arial`;
      ctx.fillStyle = b.fill;
      ctx.textAlign = b.textAnchor as 'start' | 'end' | 'left' | 'right' | 'center';
      ctx.fillText(b.content, b.x, b.y);
    }
    return canvas.toBuffer('image/png');
  }

  /**
   * Dibuja texto (definido como SVG) sobre una imagen base.
   *
   * En Termux (sin sharp, sin librsvg):
   *   1. FFmpeg drawtext filter  ← funciona en Termux, no necesita librsvg
   *   2. resvg-js + Jimp         ← si está instalado
   *   3. @napi-rs/canvas         ← parseo manual
   *   4. imagen base sin texto   ← último recurso
   */
  static async compositeText(
    imagePath: string,
    svgContent: string,
    width: number,
    height: number,
  ): Promise<Buffer> {
    const useSharp = await this.isSharpAvailable();
    if (useSharp) return await this.compositeTextSharp(imagePath, svgContent);
    return await this.compositeTextFallback(imagePath, svgContent, width, height);
  }

  private static async compositeTextSharp(imagePath: string, svgContent: string): Promise<Buffer> {
    const sharp = (await import('sharp')).default;
    const svgBuffer = Buffer.from(svgContent);
    const pngFromSvg = await sharp(svgBuffer).png().toBuffer();
    return await sharp(imagePath)
      .composite([{ input: pngFromSvg, top: 0, left: 0 }])
      .png()
      .toBuffer();
  }

  private static async compositeTextFallback(
    imagePath: string,
    svgContent: string,
    width: number,
    _height: number,
  ): Promise<Buffer> {
    if (!existsSync(this.TEMP_DIR)) mkdirSync(this.TEMP_DIR, { recursive: true });

    try {
      return await this.compositeTextFFmpegDrawtext(imagePath, svgContent);
    } catch (err) {
      logger.warn('[ImageProcessor] FFmpeg drawtext falló:', err);
    }

    if (await this.isResvgAvailable()) {
      try {
        const { Resvg } = await import('@resvg/resvg-js');
        const resvg = new Resvg(svgContent, { fitTo: { mode: 'width', value: width } });
        const svgBuffer = Buffer.from(resvg.render().asPng());
        const base = await Jimp.read(imagePath);
        const overlay = await Jimp.read(svgBuffer);
        base.composite(overlay, 0, 0);
        return await base.getBuffer('image/png');
      } catch (err) {
        logger.warn('[ImageProcessor] resvg+Jimp composite falló:', err);
      }
    }

    try {
      return await this.compositeTextCanvas(imagePath, svgContent);
    } catch {
      logger.warn('[ImageProcessor] Canvas fallback falló, devolviendo imagen base');
    }

    logger.error('[ImageProcessor] Todos los métodos fallaron, enviando imagen base sin texto');
    return (await Jimp.read(imagePath)).getBuffer('image/png');
  }

  /**
   * Parsea los <text> del SVG y construye un filtro `drawtext` para FFmpeg.
   * No usa el decoder SVG de FFmpeg (librsvg), solo el filtro drawtext
   * de libavfilter — que sí está disponible en el FFmpeg de Termux.
   */
  private static async compositeTextFFmpegDrawtext(
    imagePath: string,
    svgContent: string,
  ): Promise<Buffer> {
    const blocks = this.parseSvgTextBlocks(svgContent);
    if (blocks.length === 0) {
      return (await Jimp.read(imagePath)).getBuffer('image/png');
    }

    const filters = blocks.map(b => this.buildDrawtextFilter(b)).filter(Boolean);
    if (filters.length === 0) {
      return (await Jimp.read(imagePath)).getBuffer('image/png');
    }

    const outPath = join(this.TEMP_DIR, `drawtext-${Date.now()}.png`);

    await new Promise<void>((resolve, reject) => {
      const args = ['-y', '-i', imagePath, '-vf', filters.join(','), outPath];
      logger.debug(`[ImageProcessor] FFmpeg drawtext: ${filters.length} bloque(s) de texto`);
      const proc = spawn('ffmpeg', args);
      let stderr = '';
      proc.stderr.on('data', d => (stderr += d.toString()));
      proc.on('close', code =>
        code === 0
          ? resolve()
          : reject(new Error(`FFmpeg drawtext exit ${code}: ${stderr.slice(-500)}`)),
      );
      proc.on('error', reject);
    });

    const result = readFileSync(outPath);
    this.cleanup(outPath);
    return result;
  }

  /**
   * Convierte un ParsedTextBlock a una cláusula `drawtext` de FFmpeg.
   *
   * Notas:
   * - SVG  y = baseline del texto
   * - FFmpeg y = borde superior del bounding box → restamos ~82% del fontSize
   * - text-anchor="middle" → x = cx - text_w/2 (expresión FFmpeg)
   * - Colores: SVG #RRGGBB → FFmpeg 0xRRGGBBAA
   */
  private static buildDrawtextFilter(b: ParsedTextBlock): string {
    if (!b.content) return '';

    // Escapado para FFmpeg drawtext
    // El texto va entre comillas simples; hay que escapar: \ : '
    const escaped = b.content
      .replace(/\\/g, '\\\\')
      .replace(/'/g, '') // eliminar apóstrofes (escaparlos falla en algunas versiones)
      .replace(/:/g, '\\:')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]');

    // Color SVG → FFmpeg (0xRRGGBBFF)
    let color = b.fill;
    if (color.startsWith('#')) {
      const hex = color.replace('#', '');
      color = `0x${
        hex.length === 3
          ? hex
              .split('')
              .map(c => c + c)
              .join('')
          : hex
      }FF`;
    }

    // Posición X según text-anchor
    let xExpr: string;
    if (b.textAnchor === 'middle') {
      xExpr = `${b.x}-text_w/2`;
    } else if (b.textAnchor === 'end') {
      xExpr = `${b.x}-text_w`;
    } else {
      xExpr = `${b.x}`;
    }

    // SVG baseline → FFmpeg top (aproximación: 82% del font-size)
    const yVal = Math.max(0, Math.round(b.y - b.fontSize * 0.82));
    const boldFlag = b.fontWeight === 'bold' ? 1 : 0;

    return `drawtext=text='${escaped}':x=${xExpr}:y=${yVal}:fontsize=${b.fontSize}:fontcolor=${color}:bold=${boldFlag}`;
  }

  private static parseSvgTextBlocks(svgContent: string): ParsedTextBlock[] {
    const regex = /<text([^>]*)>([\s\S]*?)<\/text>/gi;
    const blocks: ParsedTextBlock[] = [];

    for (const [, attrs, rawContent] of svgContent.matchAll(regex)) {
      const content = rawContent
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .trim();

      if (!content) continue;

      blocks.push({
        content,
        x: parseFloat(attrs.match(/\bx="([\d.-]+)"/)?.[1] ?? '0'),
        y: parseFloat(attrs.match(/\by="([\d.-]+)"/)?.[1] ?? '0'),
        fontSize: parseInt(attrs.match(/font-size="(\d+)"/)?.[1] ?? '40', 10),
        fill: attrs.match(/fill="([^"]+)"/)?.[1] ?? '#ffffff',
        fontWeight: attrs.match(/font-weight="([^"]+)"/)?.[1] ?? 'normal',
        textAnchor: attrs.match(/text-anchor="([^"]+)"/)?.[1] ?? 'start',
      });
    }

    return blocks;
  }

  private static async compositeTextCanvas(imagePath: string, svgContent: string): Promise<Buffer> {
    const { createCanvas, loadImage } = await import('@napi-rs/canvas');
    const base = await loadImage(imagePath);
    const canvas = createCanvas(base.width, base.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(base, 0, 0);

    const blocks = this.parseSvgTextBlocks(svgContent);
    for (const b of blocks) {
      ctx.font = `${b.fontWeight} ${b.fontSize}px Arial`;
      ctx.fillStyle = b.fill;
      ctx.textAlign = b.textAnchor as 'start' | 'end' | 'left' | 'right' | 'center';
      ctx.fillText(b.content, b.x, b.y);
    }
    return canvas.toBuffer('image/png');
  }

  /**
   * Resize con COVER (recorta para rellenar el cuadro).
   * Usar solo cuando se prefiere rellenar sin bordes negros.
   */
  static async resizeImage(buffer: Buffer, width: number, height: number): Promise<Buffer> {
    const useSharp = await this.isSharpAvailable();
    if (useSharp) {
      const sharp = (await import('sharp')).default;
      return await sharp(buffer).resize(width, height, { fit: 'cover' }).png().toBuffer();
    }
    const image = await Jimp.read(buffer);
    image.cover({ w: width, h: height });
    return await image.getBuffer('image/png');
  }

  /**
   * Resize con CONTAIN (escala proporcional, rellena con transparente).
   * Usar para stickers y quotes donde no se puede recortar el contenido.
   */
  static async resizeContain(buffer: Buffer, width: number, height: number): Promise<Buffer> {
    const useSharp = await this.isSharpAvailable();
    if (useSharp) {
      const sharp = (await import('sharp')).default;
      return await sharp(buffer)
        .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
    }
    // Jimp: contain mantiene aspect ratio, rellena con transparente
    const image = await Jimp.read(buffer);
    image.contain({ w: width, h: height });
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
