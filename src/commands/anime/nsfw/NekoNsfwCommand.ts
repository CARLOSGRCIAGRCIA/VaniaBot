import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class NekoNsfwCommand extends Command {
  name = 'nekonsfw';
  description = 'Imagen NSFW de neko';
  category = CommandCategory.ANIME;
  aliases = ['nekonsfw', 'nekoxxx'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!nekonsfw';
  examples = ['!nekonsfw'];
  permissions = { user: [PermissionLevel.USER], bot: [] };
  enabled = false;

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🔞');
    try {
      const imageUrl = await deliriusService.getReactionsImage('nekonsfw');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: { url: imageUrl },
        gifPlayback: true,
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[NekoNsfwCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
