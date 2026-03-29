import { Jimp } from 'jimp';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { logError, logger } from '@/utils/logger.js';
import { spawn } from 'child_process';

const execAsync = promisify(exec);

export class ConverterService {
  private static readonly TEMP_DIR = './data/temp';
  private static sharpAvailable: boolean | null = null;
  private static ffmpegAvailable: boolean | null = null;

  constructor() {
    if (!existsSync(ConverterService.TEMP_DIR)) {
      mkdirSync(ConverterService.TEMP_DIR, { recursive: true });
    }
  }

  private static async isSharpAvailable(): Promise<boolean> {
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
      logger.warn('[ConverterService] Sharp not available, using Jimp fallback');
    }
    return this.sharpAvailable;
  }

  static async isFFmpegAvailable(): Promise<boolean> {
    if (ConverterService.ffmpegAvailable !== null) return ConverterService.ffmpegAvailable;
    try {
      await execAsync('ffmpeg -version');
      ConverterService.ffmpegAvailable = true;
    } catch {
      ConverterService.ffmpegAvailable = false;
      logger.warn('[ConverterService] FFmpeg not available');
    }
    return ConverterService.ffmpegAvailable;
  }

  private static async isFFmpegAvailableAsync(): Promise<boolean> {
    return ConverterService.isFFmpegAvailable();
  }

  async convertImage(
    buffer: Buffer,
    format: 'jpeg' | 'png' | 'webp',
    options?: { quality?: number },
  ): Promise<Buffer> {
    const useSharp = await ConverterService.isSharpAvailable();

    if (useSharp) {
      try {
        const sharp = (await import('sharp')).default;
        const image = sharp(buffer);

        switch (format) {
          case 'jpeg':
            return await image.jpeg({ quality: options?.quality || 90 }).toBuffer();
          case 'png':
            return await image.png({ compressionLevel: 9 }).toBuffer();
          case 'webp':
            return await image.webp({ quality: options?.quality || 90 }).toBuffer();
          default:
            throw new Error(`Formato no soportado: ${format}`);
        }
      } catch (error) {
        logError('ConverterService.convertImage (sharp)', error);
      }
    }

    return this.convertImageJimp(buffer, format, options?.quality);
  }

  private async convertImageJimp(
    buffer: Buffer,
    format: 'jpeg' | 'png' | 'webp',
    quality: number = 90,
  ): Promise<Buffer> {
    const image = await Jimp.read(buffer);

    switch (format) {
      case 'jpeg':
        return await image.getBuffer('image/jpeg');
      case 'png':
        return await image.getBuffer('image/png');
      case 'webp': {
        const tempPath = join(ConverterService.TEMP_DIR, `convert-${Date.now()}.webp`);
        try {
          const pngBuffer = await image.getBuffer('image/png');
          writeFileSync(tempPath, pngBuffer);
          await this.ffmpegConvertToWebp(tempPath, quality);
          const result = readFileSync(tempPath);
          this.cleanup(tempPath);
          return result;
        } catch {
          this.cleanup(tempPath);
          return await image.getBuffer('image/png');
        }
      }
      default:
        return await image.getBuffer('image/png');
    }
  }

  async resizeImage(
    buffer: Buffer,
    width?: number,
    height?: number,
    options?: { fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside' },
  ): Promise<Buffer> {
    const useSharp = await ConverterService.isSharpAvailable();

    if (useSharp) {
      try {
        const sharp = (await import('sharp')).default;
        return await sharp(buffer)
          .resize(width, height, {
            fit: options?.fit || 'inside',
          })
          .toBuffer();
      } catch (error) {
        logError('ConverterService.resizeImage (sharp)', error);
      }
    }

    return this.resizeImageJimp(buffer, width, height);
  }

  private async resizeImageJimp(buffer: Buffer, width?: number, height?: number): Promise<Buffer> {
    const image = await Jimp.read(buffer);

    if (width && height) {
      image.cover({ w: width, h: height });
    } else if (width) {
      image.resize({ w: width });
    } else if (height) {
      image.resize({ h: height });
    }

    return await image.getBuffer('image/png');
  }

  async compressImage(buffer: Buffer, quality: number = 80): Promise<Buffer> {
    const useSharp = await ConverterService.isSharpAvailable();

    if (useSharp) {
      try {
        const sharp = (await import('sharp')).default;
        const metadata = await sharp(buffer).metadata();

        if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
          return await sharp(buffer).jpeg({ quality }).toBuffer();
        } else if (metadata.format === 'png') {
          return await sharp(buffer)
            .png({ compressionLevel: Math.floor((100 - quality) / 10) })
            .toBuffer();
        } else {
          return await sharp(buffer).webp({ quality }).toBuffer();
        }
      } catch (error) {
        logError('ConverterService.compressImage (sharp)', error);
      }
    }

    return this.compressImageJimp(buffer, quality);
  }

  private async compressImageJimp(buffer: Buffer, _quality: number): Promise<Buffer> {
    const image = await Jimp.read(buffer);
    return await image.getBuffer('image/jpeg');
  }

  async convertVideoToMP4(buffer: Buffer): Promise<Buffer> {
    const ffmpegAvailable = await ConverterService.isFFmpegAvailableAsync();
    if (!ffmpegAvailable) {
      throw new Error('FFmpeg no está instalado. No se puede convertir video.');
    }

    const tempInput = join(ConverterService.TEMP_DIR, `input-${Date.now()}.video`);
    const tempOutput = join(ConverterService.TEMP_DIR, `output-${Date.now()}.mp4`);

    try {
      writeFileSync(tempInput, buffer);

      const cmd = `ffmpeg -y -i ${tempInput} -c:v libx264 -preset fast -c:a aac -b:a 128k ${tempOutput}`;
      await execAsync(cmd);

      const result = readFileSync(tempOutput);
      this.cleanup(tempInput, tempOutput);
      return result;
    } catch (error) {
      this.cleanup(tempInput, tempOutput);
      logError('ConverterService.convertVideoToMP4', error);
      throw new Error('Error convirtiendo video. FFmpeg puede no estar instalado.');
    }
  }

  async extractAudioFromVideo(buffer: Buffer, format: 'mp3' | 'ogg' = 'mp3'): Promise<Buffer> {
    const ffmpegAvailable = await ConverterService.isFFmpegAvailableAsync();
    if (!ffmpegAvailable) {
      throw new Error('FFmpeg no está instalado. No se puede extraer audio.');
    }

    const tempInput = join(ConverterService.TEMP_DIR, `input-${Date.now()}.video`);
    const tempOutput = join(ConverterService.TEMP_DIR, `output-${Date.now()}.${format}`);

    try {
      writeFileSync(tempInput, buffer);

      const cmd =
        format === 'mp3'
          ? `ffmpeg -y -i ${tempInput} -vn -ar 44100 -ac 2 -b:a 192k ${tempOutput}`
          : `ffmpeg -y -i ${tempInput} -vn -c:a libvorbis ${tempOutput}`;

      await execAsync(cmd);

      const result = readFileSync(tempOutput);
      this.cleanup(tempInput, tempOutput);
      return result;
    } catch (error) {
      this.cleanup(tempInput, tempOutput);
      logError('ConverterService.extractAudioFromVideo', error);
      throw new Error('Error extrayendo audio. FFmpeg puede no estar instalado.');
    }
  }

  async convertAudio(buffer: Buffer, format: 'mp3' | 'ogg' | 'wav'): Promise<Buffer> {
    const ffmpegAvailable = await ConverterService.isFFmpegAvailableAsync();
    if (!ffmpegAvailable) {
      throw new Error('FFmpeg no está instalado. No se puede convertir audio.');
    }

    const tempInput = join(ConverterService.TEMP_DIR, `input-${Date.now()}.audio`);
    const tempOutput = join(ConverterService.TEMP_DIR, `output-${Date.now()}.${format}`);

    try {
      writeFileSync(tempInput, buffer);

      let cmd: string;
      switch (format) {
        case 'mp3':
          cmd = `ffmpeg -y -i ${tempInput} -vn -ar 44100 -ac 2 -b:a 192k ${tempOutput}`;
          break;
        case 'ogg':
          cmd = `ffmpeg -y -i ${tempInput} -vn -c:a libvorbis ${tempOutput}`;
          break;
        case 'wav':
          cmd = `ffmpeg -y -i ${tempInput} -acodec pcm_s16le ${tempOutput}`;
          break;
        default:
          throw new Error(`Formato no soportado: ${format}`);
      }

      await execAsync(cmd);

      const result = readFileSync(tempOutput);
      this.cleanup(tempInput, tempOutput);
      return result;
    } catch (error) {
      this.cleanup(tempInput, tempOutput);
      logError('ConverterService.convertAudio', error);
      throw new Error('Error convirtiendo audio. FFmpeg puede no estar instalado.');
    }
  }

  async createVideoThumbnail(buffer: Buffer, timestamp: string = '00:00:01'): Promise<Buffer> {
    const ffmpegAvailable = await ConverterService.isFFmpegAvailableAsync();
    if (!ffmpegAvailable) {
      throw new Error('FFmpeg no está instalado. No se puede crear thumbnail.');
    }

    const tempInput = join(ConverterService.TEMP_DIR, `input-${Date.now()}.video`);
    const tempOutput = join(ConverterService.TEMP_DIR, `thumb-${Date.now()}.jpg`);

    try {
      writeFileSync(tempInput, buffer);

      const cmd = `ffmpeg -y -i ${tempInput} -ss ${timestamp} -vframes 1 ${tempOutput}`;
      await execAsync(cmd);

      const result = readFileSync(tempOutput);
      this.cleanup(tempInput, tempOutput);
      return result;
    } catch (error) {
      this.cleanup(tempInput, tempOutput);
      logError('ConverterService.createVideoThumbnail', error);
      throw new Error('Error creando thumbnail. FFmpeg puede no estar instalado.');
    }
  }

  private async ffmpegConvertToWebp(inputPath: string, quality: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const outputPath = inputPath.replace('.webp', '-converted.webp');
      const args = [
        '-y',
        '-i',
        inputPath,
        '-vf',
        `scale=512:-1:flags=lanczos`,
        '-f',
        'webp',
        '-quality',
        String(quality),
        outputPath,
      ];
      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';
      ffmpeg.stderr.on('data', data => {
        stderr += data.toString();
      });
      ffmpeg.on('close', code => {
        if (code === 0) {
          if (existsSync(outputPath)) {
            const converted = readFileSync(outputPath);
            writeFileSync(inputPath, converted);
            this.cleanup(outputPath);
          }
          resolve();
        } else {
          reject(new Error(`FFmpeg webp conversion failed: ${stderr}`));
        }
      });
      ffmpeg.on('error', reject);
    });
  }

  private cleanup(...files: string[]): void {
    files.forEach(file => {
      try {
        if (existsSync(file)) {
          unlinkSync(file);
        }
      } catch {
        // Ignore file cleanup errors
      }
    });
  }
}
