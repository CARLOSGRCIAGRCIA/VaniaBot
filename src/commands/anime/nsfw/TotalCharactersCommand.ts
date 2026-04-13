import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class TotalCharactersCommand extends Command {
  name = 'totalcharacters';
  description = 'Muestra lista de personajes disponibles';
  category = CommandCategory.ANIME;
  aliases = ['tc', 'characters'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!totalcharacters';
  examples = ['!totalcharacters'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('📋');
    try {
      const imageUrl = await deliriusService.getAnimeImage('total_characters');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[TotalCharactersCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la lista. Intenta de nuevo.');
    }
  }
}
