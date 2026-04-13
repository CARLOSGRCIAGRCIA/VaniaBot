import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class NhentaisearchCommand extends Command {
  name = 'nhentaisearch';
  description = 'Busca en NHentai';
  category = CommandCategory.ANIME;
  aliases = ['nhentaisearch'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!nhentaisearch <busqueda>';
  examples = ['!nhentaisearch lisa'];
  permissions = { user: [PermissionLevel.USER], bot: [] };
  enabled = false;

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !nhentaisearch <busqueda>\n_Ejemplo: !nhentaisearch lisa_');
      return;
    }

    await ctx.react('🔍');
    try {
      const imageUrl = await deliriusService.getAnimeImage(
        `nhentaiseARCH?query=${encodeURIComponent(query)}`,
      );
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[NhentaisearchCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude realizar la búsqueda. Intenta de nuevo.');
    }
  }
}
