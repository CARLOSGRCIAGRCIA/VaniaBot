import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class SmugCommand extends Command {
  name = 'smug';
  description = 'Muestra una imagen de anime sorrube';
  category = CommandCategory.ANIME;
  aliases = ['smug'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!smug';
  examples = ['!smug'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('😏');
    try {
      const imageUrl = await deliriusService.getReactionsImage('smug');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[SmugCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
