import sharp from 'sharp';
import axios from 'axios';
import { logError } from '@/utils/logger.js';

export class StickerHelper {
  private static buildExifBuffer(): Buffer {
    const json = {
      'sticker-pack-id': `com.VaniaBot.${Date.now()}`,
      'sticker-pack-name': 'VaniaBot Stickers',
      'sticker-pack-publisher': 'VaniaBot',
      'emojis': ['🌸'],
    };
    const jsonBuf = Buffer.from(JSON.stringify(json), 'utf-8');

    const header = Buffer.from([
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x41, 0x57, 0x07, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
    ]);
    header.writeUInt32LE(jsonBuf.length, 14);
    return Buffer.concat([header, jsonBuf]);
  }

  private static injectExif(webp: Buffer, exif: Buffer): Buffer {
    if (webp.toString('ascii', 0, 4) !== 'RIFF' || webp.toString('ascii', 8, 12) !== 'WEBP') {
      throw new Error('Buffer no es WebP válido');
    }

    const exifSizeBuf = Buffer.alloc(4);
    exifSizeBuf.writeUInt32LE(exif.length, 0);
    const padding = exif.length % 2 !== 0 ? Buffer.from([0x00]) : Buffer.alloc(0);
    const exifChunk = Buffer.concat([Buffer.from('EXIF'), exifSizeBuf, exif, padding]);

    const chunkType = webp.toString('ascii', 12, 16);

    if (chunkType === 'VP8X') {
      const out = Buffer.from(webp);
      out[20] |= 0x08;
      const newSize = Buffer.alloc(4);
      newSize.writeUInt32LE(out.length - 8 + exifChunk.length, 0);
      newSize.copy(out, 4);
      return Buffer.concat([out, exifChunk]);
    }

    const vp8xPayload = Buffer.from([
      0x08, 0x00, 0x00, 0x00, 
      0xff, 0x01, 0x00,       
      0xff, 0x01, 0x00,      
    ]);
    const vp8xSizeBuf = Buffer.alloc(4);
    vp8xSizeBuf.writeUInt32LE(10, 0);
    const vp8xChunk = Buffer.concat([Buffer.from('VP8X'), vp8xSizeBuf, vp8xPayload]);

    const imageData = webp.slice(12); // todo lo que va después de "RIFF????WEBP"
    const totalPayload = 4 + vp8xChunk.length + imageData.length + exifChunk.length;
    const riffSize = Buffer.alloc(4);
    riffSize.writeUInt32LE(totalPayload, 0);

    return Buffer.concat([
      Buffer.from('RIFF'),
      riffSize,
      Buffer.from('WEBP'),
      vp8xChunk,
      imageData,
      exifChunk,
    ]);
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