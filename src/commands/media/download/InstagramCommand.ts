import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { primeService } from '@/services/system/PrimeService.js';
import { InstagramDownloader } from '@/services/download/InstagramDownloader.js';
import { isRight } from '@/utils/either.js';
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
        `˚₊· ͟͟͞͞➳ *oops, necesito el enlace de Instagram* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *!instagram* <URL>\n` +
          `✩ ejemplo: *!instagram https://www.instagram.com/reel/XXXXXXXXXX/* ✩`,
      );
      return;
    }

    const url = ctx.args[0];

    if (!this.downloader.isValidUrl(url)) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *oops, ese enlace no me sirve* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ necesito un link válido de Instagram\n` +
          `✩ acepto: */reel/*, */p/*, */tv/*, */stories/* ✩`,
      );
      return;
    }

    await ctx.react('🔍');

    try {
      const infoResult = await this.downloader.getMediaInfo(url);

      const info = infoResult._tag === 'Right' ? infoResult.right : null;
      const isImage = info?.type === 'image';

      await ctx.reply(
        (info
          ? `${isImage ? '˚₊·' : '✩'} *autor:* @${info.author}\n` +
            `✿ *título:* ${info.title.substring(0, 80)}\n\n`
          : '') + `✩ un momentito, descargando... ✩`,
      );

      await ctx.react('⏳');

      const result = isImage
        ? await this.downloader.downloadImage(url)
        : await this.downloader.downloadVideo(url);

      if (!isRight(result)) {
        await ctx.react('❌');
        await ctx.reply(`❌ Download failed\n\n${result.left.message}`);
        return;
      }

      const downloadSuccess = result.right;

      const footer = await primeService.formatFooter(ctx.sock, ctx.chat.jid, ctx.chat.isGroup);
      const fileBuffer = fs.readFileSync(downloadSuccess.filePath);
      const caption =
        (info ? `${isImage ? '🖼️' : '🎬'} @${info.author}\n` : '') +
        `📊 ${downloadSuccess.size}MB\n` +
        `⚡ ${downloadSuccess.source}\n\n` +
        footer;

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

      await this.downloader['cleanup'](downloadSuccess.filePath);
    } catch (error: unknown) {
      logError('[InstagramCommand] Error', error);
      await ctx.react('❌');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await ctx.reply(`❌ Error: ${errorMessage}`);
    }
  }
}
