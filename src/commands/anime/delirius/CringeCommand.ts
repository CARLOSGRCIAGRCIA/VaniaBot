import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class CringeCommand extends Command {
  name = 'cringe';
  description = 'Muestra una imagen de anime cringe';
  category = CommandCategory.ANIME;
  aliases = ['cringe'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!cringe';
  examples = ['!cringe'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('😖');
    try {
      const imageUrl = await deliriusService.getReactionsImage('cringe');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[CringeCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
