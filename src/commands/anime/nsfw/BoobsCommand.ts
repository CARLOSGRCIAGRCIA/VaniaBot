import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class BoobsCommand extends Command {
  name = 'boobs';
  description = 'Obtiene una imagen de tetinas';
  category = CommandCategory.ANIME;
  aliases = ['boobs', 'tetas'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!boobs';
  examples = ['!boobs'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🔞');
    try {
      const imageUrl = await deliriusService.getNsfwImage('boobs');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[BoobsCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
