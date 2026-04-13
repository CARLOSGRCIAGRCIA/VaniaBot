import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class DanceCommand extends Command {
  name = 'dance';
  description = 'Muestra una imagen de anime bailando';
  category = CommandCategory.ANIME;
  aliases = ['dance', 'bailar'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!dance';
  examples = ['!dance'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('💃');
    try {
      const imageUrl = await deliriusService.getReactionsImage('dance');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[DanceCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
