import { canvasService } from '@/services/external/CanvasService.js';
import { logError } from '@/utils/logger.js';
import type { MessageContext } from '@/types/index.js';

export class CanvasBase {
  public async sendImage(
    ctx: MessageContext,
    endpoint: string,
    params?: Record<string, string>,
  ): Promise<void> {
    try {
      const imageUrl = await canvasService.getImage(endpoint, params);
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[CanvasBase]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude generar la imagen. Intenta de nuevo.');
    }
  }

  public async sendImageWithCaption(
    ctx: MessageContext,
    endpoint: string,
    params?: Record<string, string>,
    caption?: string,
  ): Promise<void> {
    try {
      const imageUrl = await canvasService.getImage(endpoint, params);
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
        caption: caption,
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[CanvasBase]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude generar la imagen. Intenta de nuevo.');
    }
  }
}
