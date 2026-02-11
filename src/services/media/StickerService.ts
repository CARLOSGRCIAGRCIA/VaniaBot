import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import sharp from "sharp";
import { exec } from "child_process";
import { promisify } from "util";
import { logger, logError } from "@/utils/logger.js";

const execAsync = promisify(exec);

export interface StickerOptions {
  pack?: string;
  author?: string;
  quality?: number;
  type?: "full" | "crop" | "circle";
}

export class StickerService {
  private static readonly TEMP_DIR = "./data/temp";
  private static readonly MAX_SIZE = 1024;
  private static readonly STICKER_SIZE = 512;

  constructor() {
    if (!existsSync(StickerService.TEMP_DIR)) {
      mkdirSync(StickerService.TEMP_DIR, { recursive: true });
    }
  }

  async imageToSticker(
    buffer: Buffer,
    options: StickerOptions = {},
  ): Promise<Buffer> {
    const tempInput = join(StickerService.TEMP_DIR, `input-${Date.now()}.png`);
    const tempOutput = join(
      StickerService.TEMP_DIR,
      `output-${Date.now()}.webp`,
    );

    try {
      let processedBuffer: Buffer;

      switch (options.type) {
        case "circle":
          processedBuffer = await this.createCircleSticker(buffer);
          break;
        case "crop":
          processedBuffer = await this.createCroppedSticker(buffer);
          break;
        case "full":
        default:
          processedBuffer = await this.createFullSticker(buffer);
          break;
      }

      writeFileSync(tempInput, processedBuffer);

      await this.convertToWebP(tempInput, tempOutput, options);

      const result = await sharp(tempOutput).toBuffer();

      this.cleanup(tempInput, tempOutput);

      return result;
    } catch (error) {
      logError("StickerService.imageToSticker", error);
      this.cleanup(tempInput, tempOutput);
      throw new Error("Error creando sticker desde imagen");
    }
  }

  async videoToSticker(
    buffer: Buffer,
    options: StickerOptions = {},
  ): Promise<Buffer> {
    const tempInput = join(StickerService.TEMP_DIR, `video-${Date.now()}.mp4`);
    const tempOutput = join(
      StickerService.TEMP_DIR,
      `sticker-${Date.now()}.webp`,
    );

    try {
      writeFileSync(tempInput, buffer);

      await this.convertVideoToWebP(tempInput, tempOutput, options);

      const result = await sharp(tempOutput).toBuffer();

      this.cleanup(tempInput, tempOutput);

      return result;
    } catch (error) {
      logError("StickerService.videoToSticker", error);
      this.cleanup(tempInput, tempOutput);
      throw new Error("Error creando sticker desde video");
    }
  }

  private async createFullSticker(buffer: Buffer): Promise<Buffer> {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    const size = StickerService.STICKER_SIZE;

    if (metadata.width! > metadata.height!) {
      return await image
        .resize(size, null, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
    } else {
      return await image
        .resize(null, size, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
    }
  }

  private async createCroppedSticker(buffer: Buffer): Promise<Buffer> {
    return await sharp(buffer)
      .resize(StickerService.STICKER_SIZE, StickerService.STICKER_SIZE, {
        fit: "cover",
        position: "center",
      })
      .png()
      .toBuffer();
  }

  private async createCircleSticker(buffer: Buffer): Promise<Buffer> {
    const size = StickerService.STICKER_SIZE;
    const radius = size / 2;

    const circle = Buffer.from(
      `<svg><circle cx="${radius}" cy="${radius}" r="${radius}" /></svg>`,
    );

    return await sharp(buffer)
      .resize(size, size, { fit: "cover", position: "center" })
      .composite([
        {
          input: circle,
          blend: "dest-in",
        },
      ])
      .png()
      .toBuffer();
  }

  private async convertToWebP(
    input: string,
    output: string,
    options: StickerOptions,
  ): Promise<void> {
    const metadata = {
      "sticker-pack-id": "vaniabot",
      "sticker-pack-name": options.pack || "VaniaBot",
      "sticker-pack-publisher": options.author || "VaniaBot",
    };

    await sharp(input)
      .webp({ quality: options.quality || 100 })
      .toFile(output);
  }

  private async convertVideoToWebP(
    input: string,
    output: string,
    options: StickerOptions,
  ): Promise<void> {
    const size = StickerService.STICKER_SIZE;

    const cmd = `ffmpeg -i ${input} -vf "scale=${size}:${size}:force_original_aspect_ratio=decrease,pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=00000000" -vcodec libwebp -lossless 0 -qscale 75 -preset default -loop 0 -an -vsync 0 -t 00:00:10 ${output}`;

    try {
      await execAsync(cmd);
    } catch (error) {
      logger.error("FFmpeg no está disponible, usando conversión simple");
      await sharp(input)
        .resize(size, size, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: options.quality || 75 })
        .toFile(output);
    }
  }

  private cleanup(...files: string[]): void {
    files.forEach((file) => {
      try {
        if (existsSync(file)) {
          unlinkSync(file);
        }
      } catch (error) {
        // Ignorar errores de limpieza
      }
    });
  }

  static async isValidImage(buffer: Buffer): Promise<boolean> {
    try {
      const metadata = await sharp(buffer).metadata();
      return !!metadata.format;
    } catch {
      return false;
    }
  }

  static async getImageInfo(buffer: Buffer): Promise<{
    width: number;
    height: number;
    format: string;
    size: number;
  }> {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || "unknown",
      size: buffer.length,
    };
  }
}
