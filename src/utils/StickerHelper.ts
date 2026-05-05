import axios from 'axios';
import { logError } from '@/utils/logger.js';
import { StickerService } from '@/services/media/StickerService.js';

const PACK_NAME = '𝙑𝙖𝙣𝙞𝙖𝘽𝙤𝙩';
const PACK_AUTHOR = '𝙑𝙖𝙣𝙞𝙖𝘽𝙤𝙩';

export class StickerHelper {
  private static service = new StickerService();

  static async createSticker(buffer: Buffer): Promise<Buffer> {
    try {
      const raw = await this.service.createSticker(buffer);
      return await this.service.addExif(raw, PACK_NAME, PACK_AUTHOR);
    } catch (error) {
      logError('[StickerHelper] Error creating sticker:', error);
      throw error;
    }
  }

  static async imageToSticker(imageBuffer: Buffer): Promise<Buffer> {
    try {
      const raw = await this.service.imageToSticker(imageBuffer);
      return await this.service.addExif(raw, PACK_NAME, PACK_AUTHOR);
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
      return await this.imageToSticker(Buffer.from(response.data));
    } catch (error) {
      logError('[StickerHelper] Error fetching image:', error);
      throw error;
    }
  }

  static async base64ToSticker(base64Data: string): Promise<Buffer> {
    try {
      const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
      return await this.imageToSticker(Buffer.from(base64Content, 'base64'));
    } catch (error) {
      logError('[StickerHelper] Error converting base64 to sticker:', error);
      throw error;
    }
  }
}
