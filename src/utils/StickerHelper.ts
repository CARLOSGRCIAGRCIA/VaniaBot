import sharp from 'sharp';
import axios from 'axios';
import { logError } from '@/utils/logger.js';

export class StickerHelper {
  private static buildExifBuffer(): Buffer {
    const json = {
      'sticker-pack-id': `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      'sticker-pack-name': 'Bot',
      'sticker-pack-publisher': 'Bot',
      'android-app-store-link': '',
      'ios-app-store-link': '',
    };

    const exifAttr = Buffer.from([
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00,
    ]);
    const jsonBuf = Buffer.from(JSON.stringify(json), 'utf-8');
    const sizeBuf = Buffer.allocUnsafe(4);
    sizeBuf.writeUInt32LE(jsonBuf.length, 0);

    return Buffer.concat([exifAttr, sizeBuf, jsonBuf]);
  }

  private static injectExif(webp: Buffer, exif: Buffer): Buffer {
    if (webp.toString('ascii', 0, 4) !== 'RIFF' || webp.toString('ascii', 8, 12) !== 'WEBP') {
      throw new Error('Buffer no es un WebP válido');
    }

    const exifPadded = exif.length % 2 === 0 ? exif : Buffer.concat([exif, Buffer.from([0x00])]);

    const chunkHeader = Buffer.from('EXIF');
    const chunkSize = Buffer.allocUnsafe(4);
    chunkSize.writeUInt32LE(exif.length, 0);
    const exifChunk = Buffer.concat([chunkHeader, chunkSize, exifPadded]);

    const newFileSize = Buffer.allocUnsafe(4);
    newFileSize.writeUInt32LE(webp.length - 8 + exifChunk.length, 0);

    return Buffer.concat([webp.slice(0, 4), newFileSize, webp.slice(8), exifChunk]);
  }

  static async imageToSticker(imageBuffer: Buffer): Promise<Buffer> {
    try {
      const webpBuffer = await sharp(imageBuffer)
        .resize(512, 512, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 80 })
        .toBuffer();

      return this.injectExif(webpBuffer, this.buildExifBuffer());
    } catch (error) {
      logError('[StickerHelper] Error converting to sticker:', error);
      throw error;
    }
  }

  static async imageUrlToSticker(imageUrl: string): Promise<Buffer> {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });
      return this.imageToSticker(Buffer.from(response.data));
    } catch (error) {
      logError('[StickerHelper] Error fetching image:', error);
      throw error;
    }
  }

  static async base64ToSticker(base64Data: string): Promise<Buffer> {
    try {
      const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
      return this.imageToSticker(Buffer.from(base64Content, 'base64'));
    } catch (error) {
      logError('[StickerHelper] Error converting base64 to sticker:', error);
      throw error;
    }
  }
}
