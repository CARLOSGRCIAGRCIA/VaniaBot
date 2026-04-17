import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class PussylickCommand extends Command {
  name = 'pussylick';
  description = 'Imagen NSFW de pussylick';
  category = CommandCategory.ANIME;
  aliases = ['pussylick', 'lickpussy'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!pussylick';
  examples = ['!pussylick'];
  permissions = { user: [PermissionLevel.USER], bot: [] };
  enabled = false;

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🔞');
    try {
      const imageUrl = await deliriusService.getReactionsImage('pussylick');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: { url: imageUrl },
        gifPlayback: true,
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[PussylickCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
