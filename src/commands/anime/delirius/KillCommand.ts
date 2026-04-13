import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class KillCommand extends Command {
  name = 'kill';
  description = 'Muestra una imagen de anime matando';
  category = CommandCategory.ANIME;
  aliases = ['kill', 'matar'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!kill';
  examples = ['!kill'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('⚔️');
    try {
      const imageUrl = await deliriusService.getReactionsImage('kill');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[KillCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
