import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class NhentaiCommand extends Command {
  name = 'nhentai';
  description = 'Busca un hentai en NHentai';
  category = CommandCategory.ANIME;
  aliases = ['nhentaisearch'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!nhentai <codigo>';
  examples = ['!nhentai 123456'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !nhentai <código>\n_Ejemplo: !nhentai 123456');
      return;
    }

    await ctx.react('🔍');

    try {
      const data = (await deliriusService.getJson('anime', 'nhentai', { query })) as {
        result?: string;
      };

      if (data?.result) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: { url: data.result },
        });
        await ctx.react('✅');
      } else {
        await ctx.reply('❌ No se encontraron resultados.');
      }
    } catch (error) {
      logError('[NhentaiCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar. Intenta de nuevo.');
    }
  }
}
