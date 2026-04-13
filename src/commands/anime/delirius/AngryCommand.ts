import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class AngryCommand extends Command {
  name = 'angry';
  description = 'Muestra una imagen de anime enojado';
  category = CommandCategory.ANIME;
  aliases = ['angry', 'enojado'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!angry';
  examples = ['!angry'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('😡');
    try {
      const imageUrl = await deliriusService.getReactionsImage('angry');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[AngryCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
