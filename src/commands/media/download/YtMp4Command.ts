import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { primeService } from '@/services/system/PrimeService.js';
import { YouTubeDownloader } from '@/services/download/YouTubeDownloader.js';
import { MediaCardService } from '@/services/creative/MediaCardService.js';
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
          thumbnail: video.thumbnail,
          duration: video.duration,
          channel: video.channel,
          viewCount: video.viewCount,
          likeCount: video.likeCount,
        },
        thumbnailBuffer,
        '> 𝙑𝙖𝙣𝙞𝙖𝘽𝙤𝙩 𝘿𝙚𝙨𝙘𝙖𝙧𝙜𝙖𝙨 💕',
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
    info: {
      title: string;
      url: string;
      thumbnail?: string;
      duration?: string;
      channel?: string;
      viewCount?: number;
      likeCount?: number;
    },
    thumbnail: Buffer | null,
    status: string,
    quality: string,
  ): Promise<void> {
    const formatCount = (n?: number): string => {
      if (!n) return '—';
      if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
      if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
      return n.toString();
    };

    try {
      const card = await MediaCardService.generate({
        thumbnail: info.thumbnail,
        title: info.title,
        duration: info.duration,
        views: formatCount(info.viewCount),
        platform: 'youtube',
        author: info.channel,
        quality: `${quality}p`,
      });

      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: card,
        caption: `${status}`,
      });
    } catch {
      const title = info.title.length > 55 ? info.title.substring(0, 55) + '…' : info.title;

      const lines = [
        `✦ ˚₊· 𝙔𝙤𝙪𝙏𝙪𝙗𝙚 𝙑𝙞𝙙𝙚𝙤 ·₊˚ ✦`,
        ``,
        `꒰ 🎀 ꒱ ${title}`,
        ...(info.channel ? [`꒰ 🌸 ꒱ ${info.channel}`] : []),
        ...(info.duration ? [`꒰ ⏳ ꒱ ${info.duration}`] : []),
        `꒰ 🎞️ ꒱ ${quality}p`,
        ``,
        `꒰ 👁 ꒱ ${formatCount(info.viewCount)} vistas  ·  ꒰ 🤍 ꒱ ${formatCount(info.likeCount)} likes`,
        ``,
        `꒰ ✨ ꒱ ${status}...`,
        ``,
        `🔗 ${info.url}`,
      ];

      const caption = lines.join('\n');

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
