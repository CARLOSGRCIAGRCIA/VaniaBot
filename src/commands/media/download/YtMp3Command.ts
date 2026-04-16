import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { YouTubeDownloader } from '@/services/download/YouTubeDownloader.js';
import { MediaCardService } from '@/services/creative/MediaCardService.js';
import { isRight } from '@/utils/either.js';
import fs from 'fs';
import axios from 'axios';

export class YtMp3Command extends Command {
  name = 'ytmp3';
  description = 'Download YouTube audio as MP3';
  category = CommandCategory.MEDIA;
  aliases = ['yta', 'ytaudio', 'play', 'audio'];
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
        `˚₊· ͟͟͞͞➳ *oops, necesito una búsqueda o enlace* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *!ytmp3* <búsqueda o URL>\n` +
          `✩ ejemplo: *!ytmp3 bad bunny* ✩`,
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

      const thumbnailBuffer = await this.getPreviewImage(video.thumbnail);

      await this.sendPreviewWithThumbnail(
        ctx,
        {
          title: video.title,
          url: video.url,
          duration: video.duration,
          channel: video.channel,
          viewCount: video.viewCount,
          likeCount: video.likeCount,
          thumbnail: video.thumbnail,
        },
        thumbnailBuffer,
        '> 𝙑𝙖𝙣𝙞𝙖𝘽𝙤𝙩 𝘿𝙚𝙨𝙘𝙖𝙧𝙜𝙖𝙨 💕',
      );

      await ctx.react('⏳');

      const result = await this.downloader.downloadAudio(video.videoId);

      if (!isRight(result)) {
        await ctx.react('❌');
        await ctx.reply(`❌ Download failed\n\n${result.left.message}`);
        return;
      }

      const filePath = result.right.filePath;

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
        quality: 'AUDIO',
      });

      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: card,
        caption: `${status}`,
      });
    } catch {
      const title = info.title.length > 55 ? info.title.substring(0, 55) + '…' : info.title;

      const lines = [
        `✦ ˚₊· 𝙔𝙤𝙪𝙏𝙪𝙗𝙚 𝘼𝙪𝙙𝙞𝙤 ·₊˚ ✦`,
        ``,
        `꒰ 🎀 ꒱ ${title}`,
        ...(info.channel ? [`꒰ 🌸 ꒱ ${info.channel}`] : []),
        ...(info.duration ? [`꒰ ⏳ ꒱ ${info.duration}`] : []),
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
