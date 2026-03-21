import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { YouTubeDownloader } from '@/services/download/YouTubeDownloader.js';
import fs from 'fs';

export class YtMp3Command extends Command {
  name = 'ytmp3';
  description = 'Download YouTube audio as MP3';
  category = CommandCategory.MEDIA;
  aliases = ['yta', 'ytaudio'];
  usage = '!ytmp3 <search or URL>';
  examples = ['!ytmp3 bad bunny', '!ytmp3 https://youtu.be/dQw4w9WgXcQ'];
  cooldown = 30000;

  private downloader: YouTubeDownloader;

  constructor() {
    super();
    this.downloader = new YouTubeDownloader();
  }

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args.length) {
      await ctx.reply(
        '❌ Provide a search query or URL\n\n' +
          'Usage: !ytmp3 <search or URL>\n' +
          '📝 Example: !ytmp3 bad bunny',
      );
      return;
    }

    const query = ctx.args.join(' ');

    await ctx.react('🔍');

    try {
      const video = await this.downloader.searchVideo(query);

      if (!video) {
        await ctx.react('❌');
        await ctx.reply('❌ No results found');
        return;
      }

      await ctx.reply(
        `🎵 *Found:* ${video.title}\n` +
          `⏱️ *Duration:* ${video.duration}\n\n` +
          `⬇️ Downloading audio...`,
      );

      await ctx.react('⏳');

      const result = await this.downloader.downloadAudio(video.videoId);

      if (!result.success) {
        await ctx.react('❌');
        await ctx.reply(`❌ Download failed\n\n${result.error}`);
        return;
      }

      const filePath = result.filePath;
      if (!filePath) {
        await ctx.react('❌');
        await ctx.reply('❌ File path not found');
        return;
      }

      const sanitizeFilename = (title: string): string => {
        return title.replace(/[^\w\s]/gi, '');
      };

      await ctx.sock.sendMessage(ctx.chat.jid, {
        audio: fs.readFileSync(filePath),
        mimetype: 'audio/mpeg',
        fileName: `${sanitizeFilename(video.title)}.mp3`,
      });

      await ctx.react('✅');

      await this.downloader['cleanup'](filePath);
    } catch (error: unknown) {
      logError('[YtMp3Command] Error', error);
      await ctx.react('❌');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await ctx.reply(`❌ Error: ${errorMessage}`);
    }
  }
}
