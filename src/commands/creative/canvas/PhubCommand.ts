import { Command } from '../../Command.js';
import { CanvasBase } from './CanvasBase.js';
import { ImageHelper } from '@/utils/ImageHelper.js';
import { StickerHelper } from '@/utils/StickerHelper.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class PhubCommand extends Command {
  name = 'phub';
  description = 'Genera imagen estilo Pornhub';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!phub <texto>';
  examples = ['!phub Mi contenido'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args || [];
    if (args.length < 1) {
      await ctx.reply('✍️ *Uso:* !phub <texto>\n_Ejemplo: !phub Mi contenido_');
      return;
    }

    const text = args.join(' ').substring(0, 30);
    const username = ctx.sender.pushName || 'User';

    await ctx.react('🔞');

    let imageUrl = await ImageHelper.getImageOrProfile(ctx);
    if (!imageUrl) {
      imageUrl = await ImageHelper.getProfileImage(ctx);
    }

    if (!imageUrl) {
      await ctx.reply('❌ No pude obtener la foto de perfil.');
      return;
    }

    try {
      const canvasImageUrl = await new CanvasBase().getImageUrl('phub', {
        image: imageUrl,
        username,
        text,
      });
      const stickerBuffer = await StickerHelper.imageUrlToSticker(canvasImageUrl);

      await ctx.sock.sendMessage(ctx.chat.jid, {
        sticker: stickerBuffer,
      });
      await ctx.react('✅');
    } catch (error) {
      await ctx.react('❌');
      await ctx.reply('❌ No pude generar el sticker. Intenta de nuevo.');
    }
  }
}
