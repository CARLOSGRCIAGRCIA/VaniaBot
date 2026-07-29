import { Jimp } from 'jimp';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { logError, logger } from '@/utils/logger.js';

const execAsync = promisify(exec);

export class ConverterService {
  private static readonly TEMP_DIR = './data/temp';
  private static ffmpegAvailable: boolean | null = null;

  constructor() {
    if (!existsSync(ConverterService.TEMP_DIR)) {
      mkdirSync(ConverterService.TEMP_DIR, { recursive: true });
    }
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

  async convertImage(
    buffer: Buffer,
    format: 'jpeg' | 'png' | 'webp',
    options?: { quality?: number },
  ): Promise<Buffer> {
    const ffmpegAvailable = await ConverterService.isFFmpegAvailable();

    if (ffmpegAvailable) {
      try {
        return await this.ffmpegConvertImage(buffer, format, options?.quality ?? 90);
      } catch (error) {
        logError('ConverterService.convertImage (ffmpeg)', error);
      }
    }

    return this.convertImageJimp(buffer, format, options?.quality);
  }

  private async ffmpegConvertImage(
    buffer: Buffer,
    format: 'jpeg' | 'png' | 'webp',
    quality: number,
  ): Promise<Buffer> {
    const tempInput = join(ConverterService.TEMP_DIR, `conv-in-${Date.now()}.img`);
    const ext = format === 'jpeg' ? 'jpg' : format;
    const tempOutput = join(ConverterService.TEMP_DIR, `conv-out-${Date.now()}.${ext}`);

    try {
      writeFileSync(tempInput, buffer);

      let args: string[];
      switch (format) {
        case 'jpeg':
          args = [
            '-y',
            '-i',
            tempInput,
            '-qscale:v',
            String(this.qualityToJpegQScale(quality)),
            tempOutput,
          ];
          break;
        case 'png':
          args = ['-y', '-i', tempInput, '-compression_level', '9', tempOutput];
          break;
        case 'webp':
          args = ['-y', '-i', tempInput, '-quality', String(quality), tempOutput];
          break;
      }

      await this.runFFmpeg(args);
      const result = readFileSync(tempOutput);
      this.cleanup(tempInput, tempOutput);
      return result;
    } catch (error) {
      this.cleanup(tempInput, tempOutput);
      throw error;
    }
  }

  private qualityToJpegQScale(quality: number): number {
    const q = Math.max(0, Math.min(100, quality));
    return Math.round(31 - (q / 100) * 29);
  }

  private async convertImageJimp(
    buffer: Buffer,
    format: 'jpeg' | 'png' | 'webp',
    _quality: number = 90,
  ): Promise<Buffer> {
    const image = await Jimp.read(buffer);

    switch (format) {
      case 'jpeg':
        return await image.getBuffer('image/jpeg');
      case 'png':
        return await image.getBuffer('image/png');
      case 'webp':
        logger.warn('[ConverterService] webp sin ffmpeg no soportado, devolviendo PNG');
        return await image.getBuffer('image/png');
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
    const ffmpegAvailable = await ConverterService.isFFmpegAvailable();

    if (ffmpegAvailable) {
      try {
        return await this.ffmpegResizeImage(buffer, width, height, options?.fit ?? 'inside');
      } catch (error) {
        logError('ConverterService.resizeImage (ffmpeg)', error);
      }
    }

    return this.resizeImageJimp(buffer, width, height);
  }

  private async ffmpegResizeImage(
    buffer: Buffer,
    width: number | undefined,
    height: number | undefined,
    fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside',
  ): Promise<Buffer> {
    const tempInput = join(ConverterService.TEMP_DIR, `resize-in-${Date.now()}.img`);
    const tempOutput = join(ConverterService.TEMP_DIR, `resize-out-${Date.now()}.png`);

    try {
      writeFileSync(tempInput, buffer);

      const w = width ?? -1;
      const h = height ?? -1;

      let scaleFilter: string;
      switch (fit) {
        case 'fill':
          scaleFilter = `scale=${w}:${h}`;
          break;
        case 'cover':
          scaleFilter = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`;
          break;
        case 'contain':
        case 'inside':
          scaleFilter = `scale=${w}:${h}:force_original_aspect_ratio=decrease`;
          break;
        case 'outside':
          scaleFilter = `scale=${w}:${h}:force_original_aspect_ratio=increase`;
          break;
        default:
          scaleFilter = `scale=${w}:${h}`;
      }

      await this.runFFmpeg(['-y', '-i', tempInput, '-vf', scaleFilter, tempOutput]);
      const result = readFileSync(tempOutput);
      this.cleanup(tempInput, tempOutput);
      return result;
    } catch (error) {
      this.cleanup(tempInput, tempOutput);
      throw error;
    }
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
    const ffmpegAvailable = await ConverterService.isFFmpegAvailable();

    if (ffmpegAvailable) {
      try {
        return await this.ffmpegConvertImage(buffer, 'jpeg', quality);
      } catch (error) {
        logError('ConverterService.compressImage (ffmpeg)', error);
      }
    }

    return this.compressImageJimp(buffer);
  }

  private async compressImageJimp(buffer: Buffer): Promise<Buffer> {
    const image = await Jimp.read(buffer);
    return await image.getBuffer('image/jpeg');
  }

  async convertVideoToMP4(buffer: Buffer): Promise<Buffer> {
    const ffmpegAvailable = await ConverterService.isFFmpegAvailable();
    if (!ffmpegAvailable) {
      throw new Error('FFmpeg no está instalado. No se puede convertir video.');
    }

    const tempInput = join(ConverterService.TEMP_DIR, `input-${Date.now()}.video`);
    const tempOutput = join(ConverterService.TEMP_DIR, `output-${Date.now()}.mp4`);

    try {
      writeFileSync(tempInput, buffer);
      await this.runFFmpeg([
        '-y',
        '-i',
        tempInput,
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        tempOutput,
      ]);

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
    const ffmpegAvailable = await ConverterService.isFFmpegAvailable();
    if (!ffmpegAvailable) {
      throw new Error('FFmpeg no está instalado. No se puede extraer audio.');
    }

    const tempInput = join(ConverterService.TEMP_DIR, `input-${Date.now()}.video`);
    const tempOutput = join(ConverterService.TEMP_DIR, `output-${Date.now()}.${format}`);

    try {
      writeFileSync(tempInput, buffer);

      const args =
        format === 'mp3'
          ? ['-y', '-i', tempInput, '-vn', '-ar', '44100', '-ac', '2', '-b:a', '192k', tempOutput]
          : ['-y', '-i', tempInput, '-vn', '-c:a', 'libvorbis', tempOutput];

      await this.runFFmpeg(args);

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
    const ffmpegAvailable = await ConverterService.isFFmpegAvailable();
    if (!ffmpegAvailable) {
      throw new Error('FFmpeg no está instalado. No se puede convertir audio.');
    }

    const tempInput = join(ConverterService.TEMP_DIR, `input-${Date.now()}.audio`);
    const tempOutput = join(ConverterService.TEMP_DIR, `output-${Date.now()}.${format}`);

    try {
      writeFileSync(tempInput, buffer);

      let args: string[];
      switch (format) {
        case 'mp3':
          args = [
            '-y',
            '-i',
            tempInput,
            '-vn',
            '-ar',
            '44100',
            '-ac',
            '2',
            '-b:a',
            '192k',
            tempOutput,
          ];
          break;
        case 'ogg':
          args = ['-y', '-i', tempInput, '-vn', '-c:a', 'libvorbis', tempOutput];
          break;
        case 'wav':
          args = ['-y', '-i', tempInput, '-acodec', 'pcm_s16le', tempOutput];
          break;
        default:
          throw new Error(`Formato no soportado: ${format as string}`);
      }

      await this.runFFmpeg(args);

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
    const ffmpegAvailable = await ConverterService.isFFmpegAvailable();
    if (!ffmpegAvailable) {
      throw new Error('FFmpeg no está instalado. No se puede crear thumbnail.');
    }

    const tempInput = join(ConverterService.TEMP_DIR, `input-${Date.now()}.video`);
    const tempOutput = join(ConverterService.TEMP_DIR, `thumb-${Date.now()}.jpg`);

    try {
      writeFileSync(tempInput, buffer);

      await this.runFFmpeg(['-y', '-i', tempInput, '-ss', timestamp, '-vframes', '1', tempOutput]);

      const result = readFileSync(tempOutput);
      this.cleanup(tempInput, tempOutput);
      return result;
    } catch (error) {
      this.cleanup(tempInput, tempOutput);
      logError('ConverterService.createVideoThumbnail', error);
      throw new Error('Error creando thumbnail. FFmpeg puede no estar instalado.');
    }
  }

  private async runFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';
      ffmpeg.stderr.on('data', data => {
        stderr += data.toString();
      });
      ffmpeg.on('close', code => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
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
