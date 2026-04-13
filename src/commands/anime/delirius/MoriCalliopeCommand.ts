import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class MoriCalliopeCommand extends Command {
  name = 'mori';
  description = 'Obtiene una imagen de Mori Calliope';
  category = CommandCategory.ANIME;
  aliases = ['mori_calliope'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!mori';
  examples = ['!mori'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('👼');
    try {
      const imageUrl = await deliriusService.getAnimeImage('mori_calliope');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[MoriCalliopeCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
