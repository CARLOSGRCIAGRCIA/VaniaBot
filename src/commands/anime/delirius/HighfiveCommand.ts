import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class HighfiveCommand extends Command {
  name = 'highfive';
  description = 'Muestra una imagen de anime high five';
  category = CommandCategory.ANIME;
  aliases = ['highfive', 'chocar'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!highfive';
  examples = ['!highfive'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('✋');
    try {
      const imageUrl = await deliriusService.getReactionsImage('highfive');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[HighfiveCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
