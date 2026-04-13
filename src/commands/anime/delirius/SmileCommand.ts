import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class SmileCommand extends Command {
  name = 'smile';
  description = 'Muestra una imagen de anime sonriendo';
  category = CommandCategory.ANIME;
  aliases = ['smile', 'sonreir'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!smile';
  examples = ['!smile'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('😄');
    try {
      const imageUrl = await deliriusService.getReactionsImage('smile');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[SmileCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
