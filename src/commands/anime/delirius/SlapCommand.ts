import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class SlapCommand extends Command {
  name = 'slap';
  description = 'Muestra una imagen de anime golpeando';
  category = CommandCategory.ANIME;
  aliases = ['slap', 'golpear'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!slap';
  examples = ['!slap'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('👋');
    try {
      const imageUrl = await deliriusService.getReactionsImage('slap');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[SlapCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
