import { Jimp } from 'jimp';
import { readFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
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

  // undefined = sin cachear, null = no encontrada, string = ruta válida
  private static fontPath: string | null | undefined = undefined;

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
      logger.warn('[ImageProcessor] Sharp no disponible, usando FFmpeg drawtext como fallback');
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

  /**
   * Busca la primera fuente TTF utilizable por FFmpeg drawtext.
   *
   * En lugar de adivinar nombres específicos, escanea directorios completos.
   * Orden de prioridad:
   *   1. data/assets/font.ttf     (fuente propia del proyecto)
   *   2. /system/fonts/           (Android — cualquier .ttf disponible)
   *   3. Termux font packages     (pkg install font-dejavu, etc.)
   *   4. Rutas estándar de Linux  (VPS / PC)
   */
  private static findFont(): string | null {
    if (this.fontPath !== undefined) return this.fontPath;

    // 1. Fuente propia del proyecto (mayor prioridad)
    const ownFont = join(process.cwd(), 'data', 'assets', 'font.ttf');
    if (existsSync(ownFont)) {
      this.fontPath = ownFont;
      logger.warn(`[ImageProcessor] Fuente propia: ${ownFont}`);
      return this.fontPath;
    }

    // Directorios a escanear en orden de prioridad
    const scanDirs = [
      '/system/fonts',
      '/data/data/com.termux/files/usr/share/fonts/TTF',
      '/data/data/com.termux/files/usr/share/fonts/truetype/DejaVu',
      '/usr/share/fonts/truetype/dejavu',
      '/usr/share/fonts/TTF',
      '/usr/share/fonts/truetype/liberation',
      '/usr/share/fonts/truetype/freefont',
    ];

    // Nombres preferidos (sans-serif legible para memes/notas)
    const preferred = [
      'Roboto-Regular.ttf',
      'NotoSans-Regular.ttf',
      'DroidSans.ttf',
      'Arial.ttf',
      'DejaVuSans.ttf',
      'LiberationSans-Regular.ttf',
      'FreeSans.ttf',
    ];

    for (const dir of scanDirs) {
      if (!existsSync(dir)) continue;

      let files: string[];
      try {
        files = readdirSync(dir).filter(f => f.toLowerCase().endsWith('.ttf'));
      } catch {
        continue;
      }

      if (files.length === 0) continue;

      // Intentar primero los nombres preferidos
      for (const pref of preferred) {
        if (files.includes(pref)) {
          this.fontPath = join(dir, pref);
          logger.warn(`[ImageProcessor] Fuente (preferida): ${this.fontPath}`);
          return this.fontPath;
        }
      }

      // Cualquier .ttf disponible en el directorio
      this.fontPath = join(dir, files[0]);
      logger.warn(`[ImageProcessor] Fuente (primera disponible): ${this.fontPath}`);
      return this.fontPath;
    }

    this.fontPath = null;
    logger.warn(
      '[ImageProcessor] ⚠️ Sin fuente TTF.\n' +
        '  Opción A: pon cualquier .ttf en data/assets/font.ttf\n' +
        '  Opción B (Termux): pkg install font-dejavu',
    );
    return null;
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
    if (await this.isResvgAvailable()) {
      try {
        const { Resvg } = await import('@resvg/resvg-js');
        const resvg = new Resvg(svgContent, { fitTo: { mode: 'width', value: width } });
        return Buffer.from(resvg.render().asPng());
      } catch (err) {
        logger.warn('[ImageProcessor] resvg-js falló:', err);
      }
    }

    try {
      return await this.svgToBufferCanvas(svgContent, width, height);
    } catch (err) {
      logger.warn('[ImageProcessor] canvas SVG render falló:', err);
    }

    throw new Error('No hay renderer SVG disponible. Ejecuta: npm install @resvg/resvg-js');
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

  // ─────────────────────────────────────────────
  //  Composite: imagen base + texto SVG
  //
  //  En Termux (sin sharp, sin librsvg):
  //    1. FFmpeg drawtext  ← no necesita librsvg, solo una fuente TTF
  //    2. resvg-js + Jimp  ← si está instalado
  //    3. @napi-rs/canvas  ← parseo manual
  //    4. imagen base sola ← último recurso
  // ─────────────────────────────────────────────

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

    // 1. FFmpeg drawtext
    try {
      return await this.compositeTextFFmpegDrawtext(imagePath, svgContent);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[ImageProcessor] FFmpeg drawtext falló: ${msg}`);
    }

    // 2. resvg-js + Jimp
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
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`[ImageProcessor] resvg+Jimp falló: ${msg}`);
      }
    }

    // 3. @napi-rs/canvas
    try {
      return await this.compositeTextCanvas(imagePath, svgContent);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[ImageProcessor] Canvas falló: ${msg}`);
    }

    // 4. Imagen base sin texto
    logger.error('[ImageProcessor] Todos los métodos fallaron, enviando imagen base sin texto');
    return (await Jimp.read(imagePath)).getBuffer('image/png');
  }

  /**
   * Parsea los <text> del SVG y construye un filtro `drawtext` para FFmpeg.
   *
   * No usa el decoder SVG de FFmpeg (requiere librsvg, ausente en Termux).
   * Solo usa el filtro drawtext de libavfilter, disponible en el FFmpeg de Termux.
   *
   * NOTA: `bold=` eliminado — no soportado en el FFmpeg de Termux (ARM64).
   */
  private static async compositeTextFFmpegDrawtext(
    imagePath: string,
    svgContent: string,
  ): Promise<Buffer> {
    const blocks = this.parseSvgTextBlocks(svgContent);
    if (blocks.length === 0) {
      return (await Jimp.read(imagePath)).getBuffer('image/png');
    }

    const fontPath = this.findFont();

    if (!fontPath) {
      throw new Error(
        'Sin fuente TTF. Pon una en data/assets/font.ttf o ejecuta: pkg install font-dejavu',
      );
    }

    const filters = blocks.map(b => this.buildDrawtextFilter(b, fontPath)).filter(Boolean);
    if (filters.length === 0) {
      return (await Jimp.read(imagePath)).getBuffer('image/png');
    }

    const outPath = join(this.TEMP_DIR, `drawtext-${Date.now()}.png`);
    const vfArg = filters.join(',');

    logger.warn(`[ImageProcessor] FFmpeg drawtext: ${filters.length} bloque(s) | font: ${fontPath}`);

    await new Promise<void>((resolve, reject) => {
      const args = ['-y', '-i', imagePath, '-vf', vfArg, outPath];
      const proc = spawn('ffmpeg', args);
      let stderr = '';
      proc.stderr.on('data', d => (stderr += d.toString()));
      proc.on('close', code => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exit ${code}: ${stderr.slice(-800)}`));
        }
      });
      proc.on('error', err => reject(new Error(`FFmpeg spawn error: ${err.message}`)));
    });

    const result = readFileSync(outPath);
    this.cleanup(outPath);
    return result;
  }

  /**
   * Convierte un ParsedTextBlock a una cláusula `drawtext` de FFmpeg.
   *
   * - SVG  y = baseline → FFmpeg y = top del bounding box (restamos ~82% fontSize)
   * - text-anchor="middle" → x = cx - text_w/2  (expresión FFmpeg)
   * - Colores: SVG #RRGGBB → FFmpeg 0xRRGGBBAA
   * - fontfile= obligatorio en Termux/Android
   * - bold= eliminado: no soportado en Termux FFmpeg
   */
  private static buildDrawtextFilter(b: ParsedTextBlock, fontPath: string): string {
    if (!b.content) return '';

    // Escapado para FFmpeg drawtext
    // Los apóstrofes se eliminan porque escaparlos falla en algunas builds de FFmpeg
    const escaped = b.content
      .replace(/\\/g, '\\\\')
      .replace(/'/g, '')
      .replace(/:/g, '\\:')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]');

    if (!escaped.trim()) return '';

    // Color SVG → FFmpeg (0xRRGGBBFF)
    let color = b.fill;
    if (color.startsWith('#')) {
      const hex = color.replace('#', '');
      color = `0x${hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex}FF`;
    }

    // Posición X según text-anchor
    let xExpr: string;
    if (b.textAnchor === 'middle')    xExpr = `${b.x}-text_w/2`;
    else if (b.textAnchor === 'end')  xExpr = `${b.x}-text_w`;
    else                              xExpr = `${b.x}`;

    // SVG baseline → FFmpeg top (aprox. 82% del font-size)
    const yVal = Math.max(0, Math.round(b.y - b.fontSize * 0.82));

    return (
      `drawtext=fontfile='${fontPath}':text='${escaped}'` +
      `:x=${xExpr}:y=${yVal}:fontsize=${b.fontSize}:fontcolor=${color}`
    );
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
   * Usar para stickers donde no se puede recortar el contenido.
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