import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class BonkCommand extends Command {
  name = 'bonk';
  description = 'Muestra una imagen de anime bonk';
  category = CommandCategory.ANIME;
  aliases = ['bonk'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!bonk';
  examples = ['!bonk'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🔨');
    try {
      const imageUrl = await deliriusService.getReactionsImage('bonk');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[BonkCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
