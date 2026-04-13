import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class DuckCommand extends Command {
  name = 'duck';
  description = 'Obtiene una imagen de pato aleatoria';
  category = CommandCategory.ANIME;
  aliases = ['duck', 'pato'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!duck';
  examples = ['!duck'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🦆');
    try {
      const imageUrl = await deliriusService.getRandomImage('duck');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[DuckCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
