import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class HandholdCommand extends Command {
  name = 'handhold';
  description = 'Muestra una imagen de anime cogiendo las manos';
  category = CommandCategory.ANIME;
  aliases = ['handhold', 'mano'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!handhold';
  examples = ['!handhold'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🤝');
    try {
      const imageUrl = await deliriusService.getReactionsImage('handhold');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[HandholdCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
