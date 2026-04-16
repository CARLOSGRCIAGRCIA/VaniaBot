import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { primeService } from '@/services/system/PrimeService.js';
import { FacebookDownloader } from '@/services/download/FacebookDownloader.js';
import { MediaCardService } from '@/services/creative/MediaCardService.js';
import { isRight } from '@/utils/either.js';
import fs from 'fs';
import axios from 'axios';

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
      const infoResult = await this.downloader.getVideoInfo(url);
      const info = infoResult._tag === 'Right' ? infoResult.right : null;

      const thumbnailUrl = info?.thumbnailUrl;
      const thumbnailBuffer = await this.getPreviewImage(thumbnailUrl);

      try {
        const card = await MediaCardService.generate({
          thumbnail: thumbnailUrl,
          title: info?.title || 'Facebook video',
          platform: 'facebook',
          author: info?.author,
          quality: 'HD',
        });

        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: card,
          caption: `> 𝙑𝙖𝙣𝙞𝙖𝘽𝙤𝙩 𝘿𝙚𝙨𝙘𝙖𝙧𝙜𝙖𝙨 💕`,
        });
      } catch {
        const caption =
          `📺 *Facebook*\n` +
          (info ? `✿ ${info.title.substring(0, 60)}\n✿ *autor:* ${info.author}\n` : '') +
          `⬇️ descargando...\n` +
          `🔗 ${url}`;

        if (thumbnailBuffer) {
          await ctx.sock.sendMessage(ctx.chat.jid, {
            image: thumbnailBuffer,
            caption,
            mimetype: 'image/jpeg',
          });
        } else {
          await ctx.reply(caption);
        }
      }

      await ctx.react('⏳');

      const result = await this.downloader.downloadVideo(url);

      if (!isRight(result)) {
        await ctx.react('❌');
        await ctx.reply(`❌ Download failed\n\n${result.left.message}`);
        return;
      }

      const downloadSuccess = result.right;
      const filePath = downloadSuccess.filePath;

      const footer = await primeService.formatFooter(ctx.sock, ctx.chat.jid, ctx.chat.isGroup);
      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: fs.readFileSync(filePath),
        mimetype: 'video/mp4',
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

  private async getPreviewImage(thumbnailUrl?: string): Promise<Buffer | null> {
    if (!thumbnailUrl) return null;
    try {
      const response = await axios.get<ArrayBuffer>(thumbnailUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
      });
      return Buffer.from(response.data);
    } catch {
      return null;
    }
  }
}
