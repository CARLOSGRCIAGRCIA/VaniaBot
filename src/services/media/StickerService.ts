import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

export interface StickerOptions {
  pack?: string;
  author?: string;
  categories?: string[];
  quality?: number;
  type?: 'full' | 'crop' | 'circle';
}

interface FileTypeResult {
  ext: string;
  mime: string;
}
interface FileTypeModule {
  fileTypeFromBuffer?: (buffer: Buffer) => Promise<FileTypeResult | undefined>;
  fromBuffer?: (buffer: Buffer) => Promise<FileTypeResult | undefined>;
  default?: {
    fromBuffer?: (buffer: Buffer) => Promise<FileTypeResult | undefined>;
    fileTypeFromBuffer?: (buffer: Buffer) => Promise<FileTypeResult | undefined>;
  };
}

export class StickerService {
  private static readonly TEMP_DIR = './data/temp';
  private static readonly STICKER_SIZE = 512;
  private static readonly IS_ANDROID =
    process.platform === 'android' || (process.platform === 'linux' && process.arch === 'arm64');

  constructor() {
    if (!existsSync(StickerService.TEMP_DIR)) {
      mkdirSync(StickerService.TEMP_DIR, { recursive: true });
    }
  }

  private async getFileType(buffer: Buffer): Promise<{ mime: string; ext: string } | null> {
    try {
      const fileType = (await import('file-type')) as FileTypeModule;
      let result: FileTypeResult | undefined;
      if (fileType.fileTypeFromBuffer) result = await fileType.fileTypeFromBuffer(buffer);
      else if (fileType.fromBuffer) result = await fileType.fromBuffer(buffer);
      else if (fileType.default?.fromBuffer) result = await fileType.default.fromBuffer(buffer);
      else if (fileType.default?.fileTypeFromBuffer)
        result = await fileType.default.fileTypeFromBuffer(buffer);
      else return { mime: 'image/jpeg', ext: 'jpg' };
      return result || { mime: 'image/jpeg', ext: 'jpg' };
    } catch {
      return { mime: 'image/jpeg', ext: 'jpg' };
    }
  }

  async createSticker(buffer: Buffer, options: StickerOptions = {}): Promise<Buffer> {
    if (!StickerService.IS_ANDROID) {
      try {
        const { Sticker } = await import('wa-sticker-formatter');
        const sticker = new Sticker(buffer, {
          pack: options.pack || 'VaniaBot',
          author: options.author || 'VaniaBot',
          type: 'default',
          quality: options.quality || 100,
        });
        return await sticker.toBuffer();
      } catch (error) {
        console.error('Error with wa-sticker-formatter, using fallback:', error);
      }
    }
    return await this.createStickerManual(buffer, options);
  }

  async addExif(buffer: Buffer, pack: string, author: string): Promise<Buffer> {
    if (!StickerService.IS_ANDROID) {
      try {
        const { Sticker } = await import('wa-sticker-formatter');
        const sticker = new Sticker(buffer, {
          pack,
          author,
          type: 'default',
          quality: 100,
        });
        return await sticker.toBuffer();
      } catch {
        // continúa al fallback
      }
    }
    return await this.addExifManual(buffer, pack, author);
  }

  private async addExifManual(buffer: Buffer, pack: string, author: string): Promise<Buffer> {
    try {
      const packJson = JSON.stringify({
        'sticker-pack-name': pack,
        'sticker-pack-publisher': author,
      });

      const utf8 = Buffer.from(packJson, 'utf8');

      // EXIF header: TIFF little-endian + IFD con 1 entry (tag 0x5741 = 'WA')
      const header = Buffer.from([
        0x49,
        0x49,
        0x2a,
        0x00, // TIFF LE magic
        0x08,
        0x00,
        0x00,
        0x00, // offset to IFD = 8
        0x01,
        0x00, // 1 IFD entry
        0x41,
        0x57, // tag 0x5741 (WhatsApp)
        0x07,
        0x00, // type = UNDEFINED
      ]);

      const lengthBuf = Buffer.allocUnsafe(4);
      lengthBuf.writeUInt32LE(utf8.length, 0);

      const offsetBuf = Buffer.from([0x16, 0x00, 0x00, 0x00]); // offset al valor = 22
      const nextIFD = Buffer.from([0x00, 0x00, 0x00, 0x00]); // no more IFDs

      const exifData = Buffer.concat([header, lengthBuf, offsetBuf, nextIFD, utf8]);

      // Construir chunk EXIF para WebP
      const chunkId = Buffer.from('EXIF');
      const chunkSize = Buffer.allocUnsafe(4);
      chunkSize.writeUInt32LE(exifData.length, 0);
      const padding = exifData.length % 2 !== 0 ? Buffer.from([0x00]) : Buffer.alloc(0);
      const exifChunk = Buffer.concat([chunkId, chunkSize, exifData, padding]);

      // Verificar RIFF/WEBP
      if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
        console.warn('⚠️ Buffer no es WebP válido');
        return buffer;
      }

      // Activar flag EXIF en VP8X si existe, luego limpiar EXIF viejo e insertar nuevo
      const withFlag = this.ensureExtendedWebP(Buffer.from(buffer));
      const cleaned = this.removeExifChunk(withFlag);

      // Insertar EXIF después del header WEBP (byte 12)
      const riffHeader = cleaned.slice(0, 12);
      const webpBody = cleaned.slice(12);
      const newBody = Buffer.concat([exifChunk, webpBody]);
      const newFile = Buffer.concat([riffHeader, newBody]);

      // Actualizar tamaño RIFF (bytes 4-7)
      newFile.writeUInt32LE(newFile.length - 8, 4);

      return newFile;
    } catch (e) {
      console.error('addExifManual error:', e);
      return buffer;
    }
  }

  private ensureExtendedWebP(buffer: Buffer): Buffer {
    let offset = 12;
    while (offset < buffer.length - 8) {
      const chunkId = buffer.toString('ascii', offset, offset + 4);
      if (chunkId === 'VP8X') {
        // byte de flags en offset+8, bit 3 = EXIF
        buffer[offset + 8] = buffer[offset + 8] | 0x08;
        return buffer;
      }
      const chunkSize = buffer.readUInt32LE(offset + 4);
      offset += 8 + chunkSize + (chunkSize % 2 !== 0 ? 1 : 0);
    }
    return buffer;
  }

  private removeExifChunk(buffer: Buffer): Buffer {
    const result: Buffer[] = [];
    result.push(buffer.slice(0, 12));

    let offset = 12;
    while (offset < buffer.length - 8) {
      const chunkId = buffer.toString('ascii', offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);
      const totalChunkSize = 8 + chunkSize + (chunkSize % 2 !== 0 ? 1 : 0);

      if (chunkId !== 'EXIF') {
        result.push(buffer.slice(offset, offset + totalChunkSize));
      }

      offset += totalChunkSize;
    }

    const newBuffer = Buffer.concat(result);
    newBuffer.writeUInt32LE(newBuffer.length - 8, 4);
    return newBuffer;
  }

  private async createStickerManual(buffer: Buffer, options: StickerOptions = {}): Promise<Buffer> {
    const type = await this.getFileType(buffer);
    const isVideo = type?.mime.includes('video') || type?.ext === 'gif';
    if (isVideo) return await this.videoToSticker(buffer, options);
    return await this.imageToSticker(buffer, options);
  }

  async imageToSticker(buffer: Buffer, _options: StickerOptions = {}): Promise<Buffer> {
    const tempInput = join(StickerService.TEMP_DIR, `input-${Date.now()}.png`);
    const tempOutput = join(StickerService.TEMP_DIR, `output-${Date.now()}.webp`);
    try {
      writeFileSync(tempInput, buffer);
      await this.ffmpegImageProcess(tempInput, tempOutput);
      const resultBuffer = readFileSync(tempOutput);
      this.cleanup(tempInput, tempOutput);
      return resultBuffer;
    } catch {
      this.cleanup(tempInput, tempOutput);
      return await this.imageToStickerFallback(buffer);
    }
  }

  private ffmpegImageProcess(input: string, output: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-y',
        '-i',
        input,
        '-vf',
        'scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1',
        '-f',
        'webp',
        '-quality',
        '100',
        output,
      ];
      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';
      ffmpeg.stderr.on('data', data => {
        stderr += data.toString();
      });
      ffmpeg.on('close', code => {
        code === 0 ? resolve() : reject(new Error(`FFmpeg failed: ${stderr}`));
      });
      ffmpeg.on('error', reject);
    });
  }

  private async imageToStickerFallback(buffer: Buffer): Promise<Buffer> {
    try {
      const sharp = (await import('sharp')).default;
      const image = sharp(buffer);
      const metadata = await image.metadata();
      const imgWidth = metadata.width ?? 512;
      const imgHeight = metadata.height ?? 512;
      let width: number, height: number;
      if (imgWidth > imgHeight) {
        width = StickerService.STICKER_SIZE;
        height = Math.round((imgHeight / imgWidth) * StickerService.STICKER_SIZE);
      } else {
        height = StickerService.STICKER_SIZE;
        width = Math.round((imgWidth / imgHeight) * StickerService.STICKER_SIZE);
      }
      return await image
        .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .extend({
          top: Math.floor((StickerService.STICKER_SIZE - height) / 2),
          bottom: Math.ceil((StickerService.STICKER_SIZE - height) / 2),
          left: Math.floor((StickerService.STICKER_SIZE - width) / 2),
          right: Math.ceil((StickerService.STICKER_SIZE - width) / 2),
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 100, lossless: false })
        .toBuffer();
    } catch {
      console.warn('⚠️ sharp no disponible, usando jimp como fallback');
      return await this.imageToStickerJimp(buffer);
    }
  }

  private async imageToStickerJimp(buffer: Buffer): Promise<Buffer> {
    const { Jimp } = await import('jimp');
    const image = await Jimp.read(buffer);
    image.cover({ w: StickerService.STICKER_SIZE, h: StickerService.STICKER_SIZE });

    const tempInput = join(StickerService.TEMP_DIR, `jimp-${Date.now()}.png`);
    const tempOutput = join(StickerService.TEMP_DIR, `jimp-${Date.now()}.webp`);

    try {
      const pngBuffer = await image.getBuffer('image/png');
      writeFileSync(tempInput, pngBuffer);
      await this.ffmpegImageProcess(tempInput, tempOutput);
      const result = readFileSync(tempOutput);
      this.cleanup(tempInput, tempOutput);
      return result;
    } catch {
      this.cleanup(tempInput, tempOutput);
      return await image.getBuffer('image/png');
    }
  }

  async videoToSticker(buffer: Buffer, _options: StickerOptions = {}): Promise<Buffer> {
    const type = await this.getFileType(buffer);
    const tempInput = join(StickerService.TEMP_DIR, `video-${Date.now()}.${type?.ext || 'mp4'}`);
    const tempOutput = join(StickerService.TEMP_DIR, `sticker-${Date.now()}.webp`);
    try {
      writeFileSync(tempInput, buffer);
      await this.ffmpegVideoProcess(tempInput, tempOutput);
      const resultBuffer = readFileSync(tempOutput);
      this.cleanup(tempInput, tempOutput);
      return resultBuffer;
    } catch (error) {
      this.cleanup(tempInput, tempOutput);
      throw error;
    }
  }

  private ffmpegVideoProcess(input: string, output: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-y',
        '-i',
        input,
        '-vf',
        "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15,pad=320:320:-1:-1:color=white@0.0,split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse",
        '-vcodec',
        'libwebp',
        '-lossless',
        '0',
        '-qscale',
        '75',
        '-preset',
        'default',
        '-loop',
        '0',
        '-an',
        '-vsync',
        '0',
        '-t',
        '00:00:10',
        output,
      ];
      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';
      ffmpeg.stderr.on('data', data => {
        stderr += data.toString();
      });
      ffmpeg.on('close', code => {
        code === 0 ? resolve() : reject(new Error(`FFmpeg video failed: ${stderr}`));
      });
      ffmpeg.on('error', reject);
    });
  }

  private cleanup(...files: string[]): void {
    files.forEach(file => {
      try {
        if (existsSync(file)) unlinkSync(file);
      } catch {}
    });
  }

  async checkFFmpeg(): Promise<boolean> {
    return new Promise(resolve => {
      const ffmpeg = spawn('ffmpeg', ['-version']);
      ffmpeg.on('close', code => resolve(code === 0));
      ffmpeg.on('error', () => resolve(false));
    });
  }
}
