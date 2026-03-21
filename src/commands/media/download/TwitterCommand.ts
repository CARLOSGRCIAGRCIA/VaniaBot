import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { TwitterDownloader } from '@/services/download/TwitterDownloader.js';
import { logger } from '@/utils/logger.js';

export class TwitterCommand extends Command {
  name = 'twitter';
  description = 'Descarga videos de Twitter/X';
  category = CommandCategory.MEDIA;
  aliases = ['tw', 'xvideo', 'xv'];
  usage = '!twitter <url>';
  examples = [
    '!twitter https://twitter.com/user/status/123',
    '!twitter https://x.com/user/status/123',
  ];
  cooldown = 60000;
  contexts = [CommandContext.BOTH];
  mediaGroup = true;

  private downloader = new TwitterDownloader();

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args[0];

    if (!url) {
      await ctx.reply(
        `🐦 *Twitter Downloader*\n\n` +
          `*Uso:* !twitter <url>\n\n` +
          `*Ejemplos:*\n` +
          `  !twitter https://twitter.com/user/status/123\n` +
          `  !twitter https://x.com/user/status/123`,
      );
      return;
    }

    if (!this.downloader.isValidUrl(url)) {
      await ctx.reply('❌ URL inválida. Proporciona un enlace de Twitter o X.');
      return;
    }

    await ctx.react('⏬');
    await ctx.reply('🔄 Descargando video...');

    try {
      const result = await this.downloader.downloadVideo(url);

      if (!result.success || !result.filePath) {
        await ctx.reply(`❌ Error: ${result.error ?? 'No se pudo descargar'}`);
        return;
      }

      await ctx.reply('📤 Enviando video...');
      await ctx.sock.sendMessage(
        ctx.chat.jid,
        { video: { url: `file://${result.filePath}` }, mimetype: 'video/mp4' },
        { quoted: ctx.message },
      );

      await ctx.react('✅');
    } catch (error) {
      logger.error('Twitter command error:', error);
      await ctx.reply('❌ Error al descargar el video.');
    }
  }
}
