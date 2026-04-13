import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class OppaiCommand extends Command {
  name = 'oppai';
  description = 'Obtiene una imagen de oppai';
  category = CommandCategory.ANIME;
  aliases = ['oppai'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!oppai';
  examples = ['!oppai'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🍈');
    try {
      const imageUrl = await deliriusService.getAnimeImage('oppai');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[OppaiCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
