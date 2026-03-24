import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { YouTubeDownloader } from '@/services/download/YouTubeDownloader.js';
import { searchVideo } from '@/services/download/YouTubeSearchService.js';
import { logger } from '@/utils/logger.js';
import fs from 'fs';

export class SpotifyCommand extends Command {
  name = 'spotify';
  description = 'Descarga música de Spotify (busca en YouTube)';
  category = CommandCategory.MEDIA;
  aliases = ['sp', 'spot', 'music'];
  usage = '!spotify <nombre de canción>';
  examples = ['!spotify despacito', '!spotify bad bunny'];
  cooldown = 60000;
  contexts = [CommandContext.BOTH];
  mediaGroup = true;

  private downloader = new YouTubeDownloader();

  async execute(ctx: MessageContext): Promise<void> {
    const input = ctx.args.join(' ');

    if (!input) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *spotify downloader* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *cómo usar:* !spotify <nombre>\n\n` +
          `✩ *ejemplos:*\n` +
          `  ﹒!spotify despacito\n` +
          `  ﹒!spotify bad bunny - x`,
      );
      return;
    }

    await ctx.react('🔍');
    await ctx.reply(`🔍 Buscando: "${input}"...`);

    try {
      const video = await searchVideo(input);

      if (!video) {
        await ctx.react('❌');
        await ctx.reply('❌ No se encontró la canción');
        return;
      }

      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *encontré esto* ˚₊· ͟͟͞͞➳\n` +
          `✿ *título:* ${video.title}\n` +
          `✩ *duración:* ${video.duration}\n\n` +
          `✿ descargando el audio, espera un momentito ✿`,
      );

      await ctx.react('⏳');

      const result = await this.downloader.downloadAudio(video.videoId);

      if (!result.success || !result.filePath) {
        await ctx.react('❌');
        await ctx.reply(`❌ Error: ${result.error ?? 'No se pudo descargar'}`);
        return;
      }

      await ctx.reply('📤 Enviando audio...');
      await ctx.sock.sendMessage(
        ctx.chat.jid,
        { audio: fs.readFileSync(result.filePath), mimetype: 'audio/mpeg' },
        { quoted: ctx.message },
      );

      await ctx.react('✅');

      this.downloader['cleanup'](result.filePath);
    } catch (error) {
      logger.error('Spotify command error:', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al descargar la canción.');
    }
  }
}
