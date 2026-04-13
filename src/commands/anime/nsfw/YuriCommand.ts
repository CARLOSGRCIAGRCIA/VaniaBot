import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class YuriCommand extends Command {
  name = 'yuri';
  description = 'Imagen NSFW de yuri';
  category = CommandCategory.ANIME;
  aliases = ['yuri', 'lesbian'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!yuri';
  examples = ['!yuri'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🔞');
    try {
      const imageUrl = await deliriusService.getReactionsImage('yuri');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[YuriCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
