import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class YeetCommand extends Command {
  name = 'yeet';
  description = 'Muestra una imagen de anime yeet';
  category = CommandCategory.ANIME;
  aliases = ['yeet'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!yeet';
  examples = ['!yeet'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('💨');
    try {
      const imageUrl = await deliriusService.getReactionsImage('yeet');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[YeetCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
