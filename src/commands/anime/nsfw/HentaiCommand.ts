import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class HentaiCommand extends Command {
  name = 'hentai';
  description = 'Obtiene una imagen hentai aleatoria';
  category = CommandCategory.ANIME;
  aliases = ['hentai', 'hentaiimg'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!hentai';
  examples = ['!hentai'];
  permissions = { user: [PermissionLevel.USER], bot: [] };
  enabled = false;

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🔞');
    try {
      const imageUrl = await deliriusService.getNsfwImage('hentai');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[HentaiCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
