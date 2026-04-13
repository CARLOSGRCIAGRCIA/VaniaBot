import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class CryCommand extends Command {
  name = 'cry';
  description = 'Muestra una imagen de anime llorando';
  category = CommandCategory.ANIME;
  aliases = ['cry', 'llorar'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!cry';
  examples = ['!cry'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('😭');
    try {
      const imageUrl = await deliriusService.getReactionsImage('cry');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[CryCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
