import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class PicsumCommand extends Command {
  name = 'picsum';
  description = 'Obtiene una imagen aleatoria de Picsum';
  category = CommandCategory.ANIME;
  aliases = ['picsum', 'randompic'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!picsum';
  examples = ['!picsum'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🖼️');
    try {
      const imageUrl = await deliriusService.getRandomImage('picsum');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[PicsumCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
