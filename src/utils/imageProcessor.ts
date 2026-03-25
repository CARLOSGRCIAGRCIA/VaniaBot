import { Jimp } from 'jimp';
import { logger } from '@/utils/logger.js';

export interface ImageProcessorResult {
  buffer: Buffer;
  width: number;
  height: number;
}

export class ImageProcessor {
  private static sharpAvailable: boolean | null = null;

  static async isSharpAvailable(): Promise<boolean> {
    if (this.sharpAvailable !== null) return this.sharpAvailable;
    try {
      await import('sharp');
      this.sharpAvailable = true;
    } catch {
      this.sharpAvailable = false;
      logger.warn('[ImageProcessor] Sharp not available, using Jimp fallback');
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
    return await this.compositeTextJimp(imagePath, svgContent, width, height);
  }

  private static async compositeTextSharp(imagePath: string, svgContent: string): Promise<Buffer> {
    const sharp = (await import('sharp')).default;
    const image = sharp(imagePath);

    return await image
      .composite([{ input: Buffer.from(svgContent), top: 0, left: 0 }])
      .png()
      .toBuffer();
  }

  private static async compositeTextJimp(
    imagePath: string,
    _svgContent: string,
    _width: number,
    _height: number,
  ): Promise<Buffer> {
    const image = await Jimp.read(imagePath);
    return await image.getBuffer('image/png');
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
}
