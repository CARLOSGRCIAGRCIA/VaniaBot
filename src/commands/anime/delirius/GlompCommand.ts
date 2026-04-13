import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class GlompCommand extends Command {
  name = 'glomp';
  description = 'Muestra una imagen de anime glomp';
  category = CommandCategory.ANIME;
  aliases = ['glomp', 'abrazar'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!glomp';
  examples = ['!glomp'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🤗');
    try {
      const imageUrl = await deliriusService.getReactionsImage('glomp');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[GlompCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
