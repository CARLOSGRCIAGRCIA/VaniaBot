import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class FluffCommand extends Command {
  name = 'fluff';
  description = 'Muestra una imagen de anime fluff';
  category = CommandCategory.ANIME;
  aliases = ['fluff'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!fluff';
  examples = ['!fluff'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🌸');
    try {
      const imageUrl = await deliriusService.getReactionsImage('fluff');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[FluffCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
