import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { SpotifyDownloader } from '@/services/download/SpotifyDownloader.js';
import { logger } from '@/utils/logger.js';

export class SpotifyCommand extends Command {
  name = 'spotify';
  description = 'Descarga música de Spotify';
  category = CommandCategory.MEDIA;
  aliases = ['sp', 'spot'];
  usage = '!spotify <url>';
  examples = ['!spotify https://open.spotify.com/track/...'];
  cooldown = 60000;
  contexts = [CommandContext.BOTH];
  mediaGroup = true;

  private downloader = new SpotifyDownloader();

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args[0];

    if (!url) {
      await ctx.reply(
        `🎵 *Spotify Downloader*\n\n` +
          `*Uso:* !spotify <url>\n\n` +
          `*Ejemplo:*\n` +
          `  !spotify https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC`,
      );
      return;
    }

    if (!this.downloader.isValidUrl(url)) {
      await ctx.reply('❌ URL inválida. Proporciona un enlace de Spotify.');
      return;
    }

    await ctx.react('⏬');
    await ctx.reply('🔄 Descargando canción...');

    try {
      const result = await this.downloader.downloadTrack(url);

      if (!result.success || !result.filePath) {
        await ctx.reply(`❌ Error: ${result.error ?? 'No se pudo descargar'}`);
        return;
      }

      await ctx.reply('📤 Enviando audio...');
      await ctx.sock.sendMessage(
        ctx.chat.jid,
        { audio: { url: `file://${result.filePath}` }, mimetype: 'audio/mpeg' },
        { quoted: ctx.message },
      );

      await ctx.react('✅');
    } catch (error) {
      logger.error('Spotify command error:', error);
      await ctx.reply('❌ Error al descargar la canción.');
    }
  }
}
