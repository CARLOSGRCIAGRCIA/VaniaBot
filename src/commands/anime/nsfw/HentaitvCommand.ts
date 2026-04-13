import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class HentaitvCommand extends Command {
  name = 'hentaitv';
  description = 'Busca en HentaiTV';
  category = CommandCategory.ANIME;
  aliases = ['hentaitv'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!hentaitv <busqueda>';
  examples = ['!hentaitv lisa'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !hentaitv <busqueda>\n_Ejemplo: !hentaitv lisa_');
      return;
    }

    await ctx.react('🔍');
    try {
      const imageUrl = await deliriusService.getAnimeImage(
        `hentaitv?query=${encodeURIComponent(query)}`,
      );
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[HentaitvCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude realizar la búsqueda. Intenta de nuevo.');
    }
  }
}
