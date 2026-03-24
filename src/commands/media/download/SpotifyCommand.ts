import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { SpotifyDownloader } from '@/services/download/SpotifyDownloader.js';
import { logger } from '@/utils/logger.js';

export class SpotifyCommand extends Command {
  name = 'spotify';
  description = 'Descarga música de Spotify';
  category = CommandCategory.MEDIA;
  aliases = ['sp', 'spot'];
  usage = '!spotify <url o nombre>';
  examples = [
    '!spotify https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
    '!spotify despacito',
  ];
  cooldown = 60000;
  contexts = [CommandContext.BOTH];
  mediaGroup = true;

  private downloader = new SpotifyDownloader();

  async execute(ctx: MessageContext): Promise<void> {
    const input = ctx.args.join(' ');

    if (!input) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *spotify downloader* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *cómo usar:* !spotify <url o nombre>\n\n` +
          `✩ *ejemplos:*\n` +
          `  ﹒!spotify https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC\n` +
          `  ﹒!spotify despacito`,
      );
      return;
    }

    let url = input;
    let searchQuery = '';

    if (!this.downloader.isValidUrl(input)) {
      searchQuery = input;
      url = '';
    }

    await ctx.react('⏬');
    await ctx.reply(searchQuery ? `🔍 Buscando: "${searchQuery}"...` : '🔄 Descargando canción...');

    try {
      const result = searchQuery
        ? await this.downloader.searchAndDownload(searchQuery)
        : await this.downloader.downloadTrack(url);

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
