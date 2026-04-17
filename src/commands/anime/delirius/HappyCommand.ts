import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class HappyCommand extends Command {
  name = 'happy';
  description = 'Muestra una imagen de anime feliz';
  category = CommandCategory.ANIME;
  aliases = ['happy', 'feliz'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!happy';
  examples = ['!happy'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('😊');
    try {
      const imageUrl = await deliriusService.getReactionsImage('happy');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[HappyCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
