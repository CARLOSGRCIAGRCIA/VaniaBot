import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class NomCommand extends Command {
  name = 'nom';
  description = 'Muestra una imagen de anime nom';
  category = CommandCategory.ANIME;
  aliases = ['nom'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!nom';
  examples = ['!nom'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('😋');
    try {
      const imageUrl = await deliriusService.getReactionsImage('nom');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[NomCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
