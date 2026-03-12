import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { InstagramDownloader } from '@/services/download/InstagramDownloader.js';
import fs from 'fs';

export class InstagramCommand extends Command {
  name = 'instagram';
  description = 'Download Instagram Reels, posts and stories';
  category = CommandCategory.MEDIA;
  aliases = ['ig', 'insta', 'reel'];
  usage = '!instagram <URL>';
  examples = [
    '!instagram https://www.instagram.com/reel/XXXXXXXXXX/',
    '!ig https://www.instagram.com/p/XXXXXXXXXX/',
  ];
  cooldown = 30000;

  private downloader: InstagramDownloader;

  constructor() {
    super();
    this.downloader = new InstagramDownloader();
  }

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args.length) {
      await ctx.reply(
        '❌ Provide an Instagram URL\n\n' +
          'Usage: !instagram <URL>\n' +
          '📝 Example: !instagram https://www.instagram.com/reel/XXXXXXXXXX/',
      );
      return;
    }

    const url = ctx.args[0];

    if (!this.downloader.isValidUrl(url)) {
      await ctx.reply(
        '❌ Invalid URL. Please send a valid Instagram link.\n' +
          '🔗 Supported: /reel/, /p/, /tv/, /stories/',
      );
      return;
    }

    await ctx.react('🔍');

    try {
      const info = await this.downloader.getMediaInfo(url);

      const isImage = info?.type === 'image';

      await ctx.reply(
        (info
          ? `${isImage ? '🖼️' : '🎬'} *Author:* @${info.author}\n` +
            `📝 *Title:* ${info.title.substring(0, 80)}\n\n`
          : '') + `⬇️ Downloading...`,
      );

      await ctx.react('⏳');

      const result = isImage
        ? await this.downloader.downloadImage(url)
        : await this.downloader.downloadVideo(url);

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

      const fileBuffer = fs.readFileSync(filePath);
      const caption =
        (info ? `${isImage ? '🖼️' : '🎬'} @${info.author}\n` : '') +
        `📊 ${result.size}MB\n` +
        `⚡ ${result.source}\n\n` +
        `> By VaniaBot`;

      if (isImage) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: fileBuffer,
          caption,
        });
      } else {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          video: fileBuffer,
          mimetype: 'video/mp4',
          caption,
        });
      }

      await ctx.react('✅');

      await this.downloader['cleanup'](filePath);
    } catch (error: unknown) {
      console.error('Error in InstagramCommand:', error);
      await ctx.react('❌');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await ctx.reply(`❌ Error: ${errorMessage}`);
    }
  }
}
