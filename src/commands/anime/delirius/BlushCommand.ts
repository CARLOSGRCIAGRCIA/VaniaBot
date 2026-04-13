import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class BlushCommand extends Command {
  name = 'blush';
  description = 'Muestra una imagen de anime sonrojado';
  category = CommandCategory.ANIME;
  aliases = ['blush', 'sonrojado'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!blush';
  examples = ['!blush'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('😊');
    try {
      const imageUrl = await deliriusService.getReactionsImage('blush');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[BlushCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
