import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class MarinKitagawaCommand extends Command {
  name = 'marin';
  description = 'Obtiene una imagen de Marin Kitagawa';
  category = CommandCategory.ANIME;
  aliases = ['marin_kitagawa'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!marin';
  examples = ['!marin'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🎀');
    try {
      const imageUrl = await deliriusService.getAnimeImage('marin_kitagawa');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[MarinKitagawaCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
