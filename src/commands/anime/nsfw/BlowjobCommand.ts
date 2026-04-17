import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class BlowjobCommand extends Command {
  name = 'blowjob';
  description = 'Imagen NSFW de blowjob';
  category = CommandCategory.ANIME;
  aliases = ['blowjob', 'bj'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!blowjob';
  examples = ['!blowjob'];
  permissions = { user: [PermissionLevel.USER], bot: [] };
  enabled = false;

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🔞');
    try {
      const imageUrl = await deliriusService.getReactionsImage('blowjob');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: { url: imageUrl },
        gifPlayback: true,
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[BlowjobCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
