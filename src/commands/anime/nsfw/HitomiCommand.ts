import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class HitomiCommand extends Command {
  name = 'hitomi';
  description = 'Busca en Hitomi con URL';
  category = CommandCategory.ANIME;
  aliases = ['hitomi'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!hitomi <url>';
  examples = ['!hitomi https://hitomi.la/...'];
  permissions = { user: [PermissionLevel.USER], bot: [] };
  enabled = false;

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args?.join(' ').trim();

    if (!url) {
      await ctx.reply('✍️ *Uso:* !hitomi <url>\n_Ejemplo: !hitomi https://hitomi.la/..._');
      return;
    }

    if (!url.startsWith('http')) {
      await ctx.reply('❌ Debes proporcionar una URL válida de hitomi.la');
      return;
    }

    await ctx.react('🔍');
    try {
      const imageUrl = await deliriusService.getAnimeImage(`hitomi?url=${encodeURIComponent(url)}`);
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[HitomiCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude buscar en Hitomi. Intenta de nuevo.');
    }
  }
}
