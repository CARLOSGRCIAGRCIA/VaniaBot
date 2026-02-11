import sharp from "sharp";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { logger, logError } from "@/utils/logger.js";

const execAsync = promisify(exec);

export class ConverterService {
  private static readonly TEMP_DIR = "./data/temp";

  constructor() {
    if (!existsSync(ConverterService.TEMP_DIR)) {
      mkdirSync(ConverterService.TEMP_DIR, { recursive: true });
    }
  }

  async convertImage(
    buffer: Buffer,
    format: "jpeg" | "png" | "webp",
    options?: { quality?: number },
  ): Promise<Buffer> {
    try {
      let image = sharp(buffer);

      switch (format) {
        case "jpeg":
          return await image
            .jpeg({ quality: options?.quality || 90 })
            .toBuffer();
        case "png":
          return await image
            .png({ quality: options?.quality || 90 })
            .toBuffer();
        case "webp":
          return await image
            .webp({ quality: options?.quality || 90 })
            .toBuffer();
        default:
          throw new Error(`Formato no soportado: ${format}`);
      }
    } catch (error) {
      logError("ConverterService.convertImage", error);
      throw new Error("Error convirtiendo imagen");
    }
  }

  async resizeImage(
    buffer: Buffer,
    width?: number,
    height?: number,
    options?: { fit?: "cover" | "contain" | "fill" | "inside" | "outside" },
  ): Promise<Buffer> {
    try {
      return await sharp(buffer)
        .resize(width, height, {
          fit: options?.fit || "inside",
        })
        .toBuffer();
    } catch (error) {
      logError("ConverterService.resizeImage", error);
      throw new Error("Error redimensionando imagen");
    }
  }

  async compressImage(buffer: Buffer, quality: number = 80): Promise<Buffer> {
    try {
      const metadata = await sharp(buffer).metadata();

      if (metadata.format === "jpeg" || metadata.format === "jpg") {
        return await sharp(buffer).jpeg({ quality }).toBuffer();
      } else if (metadata.format === "png") {
        return await sharp(buffer).png({ quality }).toBuffer();
      } else {
        return await sharp(buffer).webp({ quality }).toBuffer();
      }
    } catch (error) {
      logError("ConverterService.compressImage", error);
      throw new Error("Error comprimiendo imagen");
    }
  }

  async convertVideoToMP4(buffer: Buffer): Promise<Buffer> {
    const tempInput = join(
      ConverterService.TEMP_DIR,
      `input-${Date.now()}.video`,
    );
    const tempOutput = join(
      ConverterService.TEMP_DIR,
      `output-${Date.now()}.mp4`,
    );

    try {
      writeFileSync(tempInput, buffer);

      const cmd = `ffmpeg -i ${tempInput} -c:v libx264 -preset fast -c:a aac -b:a 128k ${tempOutput}`;
      await execAsync(cmd);

      const result = await sharp(tempOutput).toBuffer();

      this.cleanup(tempInput, tempOutput);

      return result;
    } catch (error) {
      this.cleanup(tempInput, tempOutput);
      logError("ConverterService.convertVideoToMP4", error);
      throw new Error(
        "Error convirtiendo video. FFmpeg puede no estar instalado.",
      );
    }
  }

  async extractAudioFromVideo(
    buffer: Buffer,
    format: "mp3" | "ogg" = "mp3",
  ): Promise<Buffer> {
    const tempInput = join(
      ConverterService.TEMP_DIR,
      `input-${Date.now()}.video`,
    );
    const tempOutput = join(
      ConverterService.TEMP_DIR,
      `output-${Date.now()}.${format}`,
    );

    try {
      writeFileSync(tempInput, buffer);

      const cmd =
        format === "mp3"
          ? `ffmpeg -i ${tempInput} -vn -ar 44100 -ac 2 -b:a 192k ${tempOutput}`
          : `ffmpeg -i ${tempInput} -vn -c:a libvorbis ${tempOutput}`;

      await execAsync(cmd);

      const result = await sharp(tempOutput).toBuffer();

      this.cleanup(tempInput, tempOutput);

      return result;
    } catch (error) {
      this.cleanup(tempInput, tempOutput);
      logError("ConverterService.extractAudioFromVideo", error);
      throw new Error(
        "Error extrayendo audio. FFmpeg puede no estar instalado.",
      );
    }
  }

  async convertAudio(
    buffer: Buffer,
    format: "mp3" | "ogg" | "wav",
  ): Promise<Buffer> {
    const tempInput = join(
      ConverterService.TEMP_DIR,
      `input-${Date.now()}.audio`,
    );
    const tempOutput = join(
      ConverterService.TEMP_DIR,
      `output-${Date.now()}.${format}`,
    );

    try {
      writeFileSync(tempInput, buffer);

      let cmd: string;
      switch (format) {
        case "mp3":
          cmd = `ffmpeg -i ${tempInput} -vn -ar 44100 -ac 2 -b:a 192k ${tempOutput}`;
          break;
        case "ogg":
          cmd = `ffmpeg -i ${tempInput} -c:a libvorbis ${tempOutput}`;
          break;
        case "wav":
          cmd = `ffmpeg -i ${tempInput} -acodec pcm_s16le ${tempOutput}`;
          break;
        default:
          throw new Error(`Formato no soportado: ${format}`);
      }

      await execAsync(cmd);

      const result = await sharp(tempOutput).toBuffer();

      this.cleanup(tempInput, tempOutput);

      return result;
    } catch (error) {
      this.cleanup(tempInput, tempOutput);
      logError("ConverterService.convertAudio", error);
      throw new Error(
        "Error convirtiendo audio. FFmpeg puede no estar instalado.",
      );
    }
  }

  async createVideoThumbnail(
    buffer: Buffer,
    timestamp: string = "00:00:01",
  ): Promise<Buffer> {
    const tempInput = join(
      ConverterService.TEMP_DIR,
      `input-${Date.now()}.video`,
    );
    const tempOutput = join(
      ConverterService.TEMP_DIR,
      `thumb-${Date.now()}.jpg`,
    );

    try {
      writeFileSync(tempInput, buffer);

      const cmd = `ffmpeg -i ${tempInput} -ss ${timestamp} -vframes 1 ${tempOutput}`;
      await execAsync(cmd);

      const result = await sharp(tempOutput).toBuffer();

      this.cleanup(tempInput, tempOutput);

      return result;
    } catch (error) {
      this.cleanup(tempInput, tempOutput);
      logError("ConverterService.createVideoThumbnail", error);
      throw new Error(
        "Error creando thumbnail. FFmpeg puede no estar instalado.",
      );
    }
  }

  private cleanup(...files: string[]): void {
    files.forEach((file) => {
      try {
        if (existsSync(file)) {
          unlinkSync(file);
        }
      } catch {
        // Ignorar errores
      }
    });
  }

  static async isFFmpegAvailable(): Promise<boolean> {
    try {
      await execAsync("ffmpeg -version");
      return true;
    } catch {
      return false;
    }
  }
}
