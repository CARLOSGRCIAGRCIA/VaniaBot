import sharp from 'sharp';
import axios from 'axios';
import { logError } from '@/utils/logger.js';

export class StickerHelper {
  static async imageToSticker(imageBuffer: Buffer): Promise<Buffer> {
    try {
      const stickerBuffer = await sharp(imageBuffer)
        .resize(512, 512, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 80 })
        .toBuffer();

      return stickerBuffer;
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
      const imageBuffer = Buffer.from(response.data);
      return this.imageToSticker(imageBuffer);
    } catch (error) {
      logError('[StickerHelper] Error fetching image:', error);
      throw error;
    }
  }

  static async base64ToSticker(base64Data: string): Promise<Buffer> {
    try {
      const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Content, 'base64');
      return this.imageToSticker(imageBuffer);
    } catch (error) {
      logError('[StickerHelper] Error converting base64 to sticker:', error);
      throw error;
    }
  }
}
