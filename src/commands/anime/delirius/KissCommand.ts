import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class KissCommand extends Command {
  name = 'kiss';
  description = 'Muestra una imagen de anime besando';
  category = CommandCategory.ANIME;
  aliases = ['kiss', 'besar'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!kiss';
  examples = ['!kiss'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('💋');
    try {
      const imageUrl = await deliriusService.getReactionsImage('kiss');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[KissCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
