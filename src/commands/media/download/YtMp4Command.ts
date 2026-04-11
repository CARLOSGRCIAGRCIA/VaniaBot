import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { primeService } from '@/services/system/PrimeService.js';
import { YouTubeDownloader } from '@/services/download/YouTubeDownloader.js';
import { isRight } from '@/utils/either.js';
import fs from 'fs';
import axios from 'axios';

export class YtMp4Command extends Command {
  name = 'ytmp4';
  description = 'Download YouTube video as MP4';
  category = CommandCategory.MEDIA;
  aliases = ['ytv', 'ytvideo', 'video'];
  usage = '!ytmp4 <search or URL> [calidad]';
  examples = [
    '!ytmp4 tutorial android',
    '!ytmp4 https://youtu.be/dQw4w9WgXcQ',
    '!ytmp4 bad bunny 1080',
  ];
  cooldown = 30000;

  private downloader: YouTubeDownloader;

  constructor() {
    super();
    this.downloader = new YouTubeDownloader();
  }

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args.length) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *oops, necesito una búsqueda o enlace* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *!ytmp4* <búsqueda o URL> [calidad]\n` +
          `✩ ejemplo: *!ytmp4 tutorial* ✩\n` +
          `✩ calidad: 360, 480, 720, 1080 (default: 720)`,
      );
      return;
    }

    const { quality, remainingArgs } = this.downloader.getQualityFromArgs(ctx.args);
    const query = remainingArgs.join(' ') || ctx.args.join(' ');

    await ctx.react('🔍');

    try {
      const video = await this.downloader.searchVideo(query);

      if (!video) {
        await ctx.react('❌');
        await ctx.reply('❌ No results found');
        return;
      }

      const thumbnailBuffer = await this.getPreviewImage(video.thumbnail);

      await this.sendPreviewWithThumbnail(
        ctx,
        {
          title: video.title,
          url: video.url,
          duration: video.duration,
        },
        thumbnailBuffer,
        'descargando',
        quality,
      );

      await ctx.react('⏳');

      const result = await this.downloader.downloadVideo(video.videoId, quality);

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
          `🎬 ${video.title}\n` +
          `📊 ${downloadSuccess.size}MB\n` +
          `⚡ ${downloadSuccess.source}\n` +
          `🔗 ${video.url}\n\n` +
          footer,
      });

      await ctx.react('✅');

      await this.downloader['cleanup'](filePath);
    } catch (error: unknown) {
      logError('[YtMp4Command] Error', error);
      await ctx.react('❌');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await ctx.reply(`❌ Error: ${errorMessage}`);
    }
  }

  private async getPreviewImage(thumbnailUrl: string): Promise<Buffer | null> {
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
    info: { title: string; url: string; duration?: string },
    thumbnail: Buffer | null,
    status: string,
    quality: string,
  ): Promise<void> {
    const caption =
      `🎬 *YouTube*\n` +
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
