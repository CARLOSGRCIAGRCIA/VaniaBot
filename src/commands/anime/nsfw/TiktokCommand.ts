import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class TiktokCommand extends Command {
  name = 'tiktok';
  description = 'Obtiene un video de TikTok aleatorio';
  category = CommandCategory.ANIME;
  aliases = ['tiktok', 'tiktoknsfw'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!tiktok';
  examples = ['!tiktok'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🔞');
    try {
      const videoUrl = await deliriusService.getNsfwImage('tiktok');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: { url: videoUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[TiktokCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener el video. Intenta de nuevo.');
    }
  }
}
