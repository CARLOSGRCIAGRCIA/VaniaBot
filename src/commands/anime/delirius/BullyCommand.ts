import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class BullyCommand extends Command {
  name = 'bully';
  description = 'Muestra una imagen de anime bullying';
  category = CommandCategory.ANIME;
  aliases = ['bully', 'acosar'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!bully';
  examples = ['!bully'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('😈');
    try {
      const imageUrl = await deliriusService.getReactionsImage('bully');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[BullyCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
