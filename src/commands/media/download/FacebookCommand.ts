import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { FacebookDownloader } from '@/services/download/FacebookDownloader.js';
import fs from 'fs';

export class FacebookCommand extends Command {
  name = 'facebook';
  description = 'Download Facebook videos and Reels';
  category = CommandCategory.MEDIA;
  aliases = ['fb', 'fbvideo'];
  usage = '!facebook <URL>';
  examples = [
    '!facebook https://www.facebook.com/watch/?v=123456789',
    '!fb https://fb.watch/XXXXXXXXXX/',
  ];
  cooldown = 30000;

  private downloader: FacebookDownloader;

  constructor() {
    super();
    this.downloader = new FacebookDownloader();
  }

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args.length) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *oops, necesito el enlace de Facebook* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *!facebook* <URL>\n` +
          `✩ ejemplo: *!facebook https://fb.watch/XXXXXXXXXX/* ✩`,
      );
      return;
    }

    const url = ctx.args[0];

    if (!this.downloader.isValidUrl(url)) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *oops, ese enlace no me sirve* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ necesito un link válido de Facebook\n` +
          `✩ solo videos públicos, por favor ✩`,
      );
      return;
    }

    await ctx.react('🔍');

    try {
      const info = await this.downloader.getVideoInfo(url);

      if (info) {
        await ctx.reply(
          `˚₊· ͟͟͞͞➳ *autor:* ${info.author} ˚₊· ͟͟͞͞➳\n` +
            `✿ *título:* ${info.title.substring(0, 80)}\n\n` +
            `✩ un momentito, estoy descargando ✩`,
        );
      } else {
        await ctx.react('⬇️');
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
          (info ? `˚₊· ͟͟͞͞➳ ${info.author}\n` : '') +
          `✩ ${result.size}MB\n` +
          `✿ ${result.source}\n\n` +
          `> VaniaBot 💝`,
      });

      await ctx.react('✅');

      await this.downloader['cleanup'](filePath);
    } catch (error: unknown) {
      logError('[FacebookCommand] Error', error);
      await ctx.react('❌');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await ctx.reply(`❌ Error: ${errorMessage}`);
    }
  }
}
