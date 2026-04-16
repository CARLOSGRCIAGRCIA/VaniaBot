import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { primeService } from '@/services/system/PrimeService.js';
import { TikTokDownloader } from '@/services/download/TikTokDownloader.js';
import { MediaCardService } from '@/services/creative/MediaCardService.js';
import { isRight } from '@/utils/either.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

export class TiktokCommand extends Command {
  name = 'tiktok';
  description = 'Download TikTok videos without watermark';
  category = CommandCategory.MEDIA;
  aliases = ['tt', 'tk'];
  usage = '!tiktok <URL> [calidad]';
  examples = [
    '!tiktok https://www.tiktok.com/@user/video/123456789',
    '!tiktok https://vm.tiktok.com/XXXXXXXX/',
    '!tiktok https://vm.tiktok.com/XXXXXXXX/ 1080',
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
        `˚₊· ͟͟͞͞➳ *oops, necesito el enlace de TikTok* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *!tiktok* <URL> [calidad]\n` +
          `✩ ejemplo: *!tiktok https://vm.tiktok.com/XXXXXXXX/* ✩\n` +
          `✩ calidad: 360, 480, 720, 1080 (default: 720)`,
      );
      return;
    }

    const { quality, remainingArgs } = this.downloader.getQualityFromArgs(ctx.args);
    const url = remainingArgs[0] || ctx.args[0];

    if (!this.downloader.isValidUrl(url)) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *oops, ese enlace no me sirve* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ necesito un link válido de TikTok\n` +
          `✩ ejemplo: *https://www.tiktok.com/@user/video/123456789* ✩`,
      );
      return;
    }

    await ctx.react('🔍');

    try {
      const infoResult = await this.downloader.getVideoInfo(url);
      const info = infoResult._tag === 'Right' ? infoResult.right : null;

      const thumbnailBuffer = await this.getPreviewImage(info?.thumbnailUrl);

      await this.sendPreviewWithThumbnail(
        ctx,
        {
          title: info?.title ?? 'TikTok video',
          author: info?.author ?? 'unknown',
          url,
          thumbnailUrl: info?.thumbnailUrl,
          duration: info?.duration,
        },
        thumbnailBuffer,
        'descargando',
        quality,
      );

      await ctx.react('⏳');

      const result = await this.downloader.downloadVideo(url, quality);

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
        caption:
          (info ? `🎵 @${info.author}\n` : '') +
          `📊 ${downloadSuccess.size}MB\n` +
          `⚡ ${downloadSuccess.source}\n` +
          `🔗 ${url}\n\n` +
          footer,
      });

      await ctx.react('✅');

      await this.downloader['cleanup'](filePath);
    } catch (error: unknown) {
      logError('[TiktokCommand] Error', error);
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

  private async sendPreviewWithThumbnail(
    ctx: MessageContext,
    info: {
      title: string;
      author: string;
      url: string;
      thumbnailUrl?: string;
      duration?: string;
    },
    thumbnail: Buffer | null,
    status: string,
    quality: string,
  ): Promise<void> {
    try {
      const card = await MediaCardService.generate({
        thumbnail: info.thumbnailUrl,
        title: info.title,
        duration: info.duration,
        platform: 'tiktok',
        author: info.author,
        quality: `${quality}p`,
        music: 'Original Sound',
      });

      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: card,
        caption: `⬇️ ${status}...`,
      });
    } catch {
      const caption =
        `🎬 *@${info.author}*\n` +
        `✿ ${info.title.substring(0, 60)}${info.title.length > 60 ? '...' : ''}\n` +
        (info.duration ? `⏱️ ${info.duration}\n` : '') +
        `📦 Calidad: ${quality}p\n` +
        `⬇️ ${status}...\n` +
        `🔗 ${info.url}`;

      if (thumbnail) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: thumbnail,
          caption,
          mimetype: 'image/jpeg',
        });
      } else {
        await ctx.reply(caption);
      }
    }
  }
}
