import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class TickleCommand extends Command {
  name = 'tickle';
  description = 'Muestra una imagen de anime tickle';
  category = CommandCategory.ANIME;
  aliases = ['tickle', 'cosquillas'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!tickle';
  examples = ['!tickle'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('😂');
    try {
      const imageUrl = await deliriusService.getReactionsImage('tickle');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[TickleCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
