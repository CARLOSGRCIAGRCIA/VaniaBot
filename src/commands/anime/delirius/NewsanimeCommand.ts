import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class NewsanimeCommand extends Command {
  name = 'newsanime';
  description = 'Muestra las últimas noticias de anime';
  category = CommandCategory.ANIME;
  aliases = ['anime_news', 'noticiasanime'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!newsanime';
  examples = ['!newsanime'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('📰');
    try {
      const imageUrl = await deliriusService.getAnimeImage('newsanime');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[NewsanimeCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener las noticias. Intenta de nuevo.');
    }
  }
}
