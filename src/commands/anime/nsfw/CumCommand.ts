import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class CumCommand extends Command {
  name = 'cum';
  description = 'Imagen NSFW de cum';
  category = CommandCategory.ANIME;
  aliases = ['cum', 'creampie'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!cum';
  examples = ['!cum'];
  permissions = { user: [PermissionLevel.USER], bot: [] };
  enabled = false;

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🔞');
    try {
      const imageUrl = await deliriusService.getReactionsImage('cum');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: { url: imageUrl },
        gifPlayback: true,
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[CumCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
