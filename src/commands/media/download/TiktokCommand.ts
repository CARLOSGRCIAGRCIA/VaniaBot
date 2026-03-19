import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { TikTokDownloader } from '@/services/download/TikTokDownloader.js';
import { logError } from '@/utils/logger.js';
import fs from 'fs';

export class TiktokCommand extends Command {
  name = 'tiktok';
  description = 'Download TikTok videos without watermark';
  category = CommandCategory.MEDIA;
  aliases = ['tt', 'tk'];
  usage = '!tiktok <URL>';
  examples = [
    '!tiktok https://www.tiktok.com/@user/video/123456789',
    '!tiktok https://vm.tiktok.com/XXXXXXXX/',
  ];
  cooldown = 30000;

  private downloader: TikTokDownloader;

  constructor() {
    super();
    this.downloader = new TikTokDownloader();
  }

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args.length) {
      await ctx.reply(
        '❌ Provide a TikTok URL\n\n' +
          'Usage: !tiktok <URL>\n' +
          '📝 Example: !tiktok https://vm.tiktok.com/XXXXXXXX/',
      );
      return;
    }

    const url = ctx.args[0];

    if (!this.downloader.isValidUrl(url)) {
      await ctx.reply(
        '❌ Invalid URL. Please send a valid TikTok link.\n' +
          '🔗 Example: https://www.tiktok.com/@user/video/123456789',
      );
      return;
    }

    await ctx.react('🔍');

    try {
      const info = await this.downloader.getVideoInfo(url);

      if (info) {
        await ctx.reply(
          `🎵 *Author:* @${info.author}\n` +
            `📝 *Title:* ${info.title.substring(0, 80)}\n\n` +
            `⬇️ Downloading...`,
        );
      } else {
        await ctx.reply('⬇️ Downloading TikTok video...');
      }

      await ctx.react('⏳');

      const result = await this.downloader.downloadVideo(url);

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

      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: fs.readFileSync(filePath),
        mimetype: 'video/mp4',
        caption:
          (info ? `🎵 @${info.author}\n` : '') +
          `📊 ${result.size}MB\n` +
          `⚡ ${result.source}\n\n` +
          `> By VaniaBot`,
      });

      await ctx.react('✅');

      await this.downloader['cleanup'](filePath);
    } catch (error: unknown) {
      logError('TiktokCommand.execute', error);
      await ctx.react('❌');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await ctx.reply(`❌ Error: ${errorMessage}`);
    }
  }
}
