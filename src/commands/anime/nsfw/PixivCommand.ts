import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class PixivCommand extends Command {
  name = 'pixiv';
  description = 'Busca en Pixiv';
  category = CommandCategory.ANIME;
  aliases = ['pixiv'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!pixiv <busqueda>';
  examples = ['!pixiv lisa'];
  permissions = { user: [PermissionLevel.USER], bot: [] };
  enabled = false;

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !pixiv <busqueda>\n_Ejemplo: !pixiv lisa_');
      return;
    }

    await ctx.react('🎨');
    try {
      const imageUrl = await deliriusService.getAnimeImage(
        `pixiv?query=${encodeURIComponent(query)}`,
      );
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[PixivCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude realizar la búsqueda. Intenta de nuevo.');
    }
  }
}
