import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class Rule34Command extends Command {
  name = 'rule34';
  description = 'Busca en Rule34';
  category = CommandCategory.ANIME;
  aliases = ['rule34'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!rule34 <busqueda>';
  examples = ['!rule34 anime'];
  permissions = { user: [PermissionLevel.USER], bot: [] };
  enabled = false;

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !rule34 <busqueda>\n_Ejemplo: !rule34 anime');
      return;
    }

    await ctx.react('🔞');
    try {
      const data = (await deliriusService.search('rule34', { query })) as { result?: string };

      if (data?.result) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: { url: data.result },
        });
        await ctx.react('✅');
      } else {
        await ctx.reply('❌ No se encontraron resultados.');
      }
    } catch (error) {
      logError('[Rule34Command]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar. Intenta de nuevo.');
    }
  }
}
