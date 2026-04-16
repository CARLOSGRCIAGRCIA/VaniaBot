import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { TwitterDownloader } from '@/services/download/TwitterDownloader.js';
import { MediaCardService } from '@/services/creative/MediaCardService.js';
import { logger } from '@/utils/logger.js';
import { isRight } from '@/utils/either.js';
import fs from 'fs';
import axios from 'axios';

export class TwitterCommand extends Command {
  name = 'twitter';
  description = 'Descarga videos de Twitter/X';
  category = CommandCategory.MEDIA;
  aliases = ['tw', 'xvideo', 'xv'];
  usage = '!twitter <url>';
  examples = [
    '!twitter https://twitter.com/user/status/123',
    '!twitter https://x.com/user/status/123',
  ];
  cooldown = 60000;
  contexts = [CommandContext.BOTH];
  mediaGroup = true;

  private downloader = new TwitterDownloader();

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args[0];

    if (!url) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *twitter downloader* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *cómo usar:* !twitter <url>\n\n` +
          `✩ *ejemplos:*\n` +
          `  ﹒!twitter https://twitter.com/user/status/123\n` +
          `  ﹒!twitter https://x.com/user/status/123`,
      );
      return;
    }

    if (!this.downloader.isValidUrl(url)) {
      await ctx.reply('❌ URL inválida. Proporciona un enlace de Twitter o X.');
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
          title: info?.title || 'Twitter/X video',
          platform: 'twitter',
          author: info?.author,
        });

        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: card,
          caption: `> 𝙑𝙖𝙣𝙞𝙖𝘽𝙤𝙩 𝘿𝙚𝙨𝙘𝙖𝙧𝙜𝙖𝙨 💕`,
        });
      } catch {
        const caption =
          `🐦 *Twitter/X*\n` +
          (info ? `✿ ${info.title.substring(0, 60)}\n` : '') +
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

      await ctx.react('⬇️');

      const result = await this.downloader.downloadVideo(url);

      if (!isRight(result)) {
        await ctx.reply(`❌ Error: ${result.left.message ?? 'No se pudo descargar'}`);
        return;
      }

      const downloadResult = result.right;
      const fileBuffer = fs.readFileSync(downloadResult.filePath);

      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: fileBuffer,
        mimetype: 'video/mp4',
      });

      await ctx.react('✅');

      await this.downloader['cleanup'](downloadResult.filePath);
    } catch (error) {
      logger.error('Twitter command error:', error);
      await ctx.reply('❌ Error al descargar el video.');
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
