import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class CharacterlistCommand extends Command {
  name = 'characterlist';
  description = 'Busca un personaje de anime';
  category = CommandCategory.ANIME;
  aliases = ['character', 'chars'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!characterlist <nombre>';
  examples = ['!characterlist Naruto', '!characterlist One Piece'];
  permissions = { user: [PermissionLevel.USER], bot: [] };
  enabled = false;

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !characterlist <nombre>\n_Ejemplo: !characterlist Naruto_');
      return;
    }

    await ctx.react('🔍');
    try {
      const imageUrl = await deliriusService.getAnimeImage(
        `characterlist?query=${encodeURIComponent(query)}`,
      );
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[CharacterlistCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude buscar el personaje. Intenta de nuevo.');
    }
  }
}
