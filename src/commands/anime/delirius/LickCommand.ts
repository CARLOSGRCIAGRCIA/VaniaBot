import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class LickCommand extends Command {
  name = 'lick';
  description = 'Muestra una imagen de anime lamiendo';
  category = CommandCategory.ANIME;
  aliases = ['lick', 'lamer'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!lick';
  examples = ['!lick'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('👅');
    try {
      const imageUrl = await deliriusService.getReactionsImage('lick');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[LickCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
