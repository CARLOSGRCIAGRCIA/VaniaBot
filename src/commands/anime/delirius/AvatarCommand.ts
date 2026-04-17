import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class AvatarCommand extends Command {
  name = 'avatar';
  description = 'Obtiene un avatar anime aleatorio';
  category = CommandCategory.ANIME;
  aliases = ['avataranime'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!avatar';
  examples = ['!avatar'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🎭');
    try {
      const imageUrl = await deliriusService.getAnimeImage('avatar/delirius?style=pixel-art');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[AvatarCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
