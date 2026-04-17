import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class TailCommand extends Command {
  name = 'tail';
  description = 'Muestra una imagen de anime con cola';
  category = CommandCategory.ANIME;
  aliases = ['tail', 'cola'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!tail';
  examples = ['!tail'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🐾');
    try {
      const imageUrl = await deliriusService.getReactionsImage('tail');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[TailCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
