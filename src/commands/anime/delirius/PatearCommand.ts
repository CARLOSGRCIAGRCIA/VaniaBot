import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class PatearCommand extends Command {
  name = 'patear';
  description = 'Muestra una imagen de anime pateando';
  category = CommandCategory.ANIME;
  aliases = ['patear'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!patear';
  examples = ['!patear'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🦶');
    try {
      const imageUrl = await deliriusService.getReactionsImage('kick');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[PatearCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
