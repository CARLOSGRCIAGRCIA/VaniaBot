import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class EeveeCommand extends Command {
  name = 'eevee';
  description = 'Muestra una imagen de Eevee';
  category = CommandCategory.ANIME;
  aliases = ['eevee'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!eevee';
  examples = ['!eevee'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🦊');
    try {
      const imageUrl = await deliriusService.getReactionsImage('eevee');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[EeveeCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
