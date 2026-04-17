import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class CuddleCommand extends Command {
  name = 'cuddle';
  description = 'Muestra una imagen de anime acurrucándose';
  category = CommandCategory.ANIME;
  aliases = ['cuddle', 'acurrucarse'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!cuddle';
  examples = ['!cuddle'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🫂');
    try {
      const imageUrl = await deliriusService.getReactionsImage('cuddle');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[CuddleCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
