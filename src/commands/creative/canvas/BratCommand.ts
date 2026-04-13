import { Command } from '../../Command.js';
import { CanvasBase } from './CanvasBase.js';
import { StickerHelper } from '@/utils/StickerHelper.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class BratCommand extends Command {
  name = 'brat';
  description = 'Genera imagen estilo Brat';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!brat <texto>';
  examples = ['!brat VaniaBot'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !brat <texto>\n_Ejemplo: !brat VaniaBot_');
      return;
    }

    await ctx.react('🎨');

    try {
      const imageUrl = await new CanvasBase().getImageUrl('brat', { text: text.substring(0, 30) });
      const stickerBuffer = await StickerHelper.imageUrlToSticker(imageUrl);

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
