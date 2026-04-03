/**
 * @fileoverview PinterestCommand.ts - Download from Pinterest
 *
 * Downloads images and videos from Pinterest.
 *
 * @module commands/media/download/PinterestCommand
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { pinterestDownloader } from '@/services/download/PinterestDownloader.js';

export class PinterestCommand extends Command {
  name = 'pinterest';
  description = 'Descarga imágenes/videos de Pinterest';
  category = CommandCategory.MEDIA;
  aliases = ['pin', 'pinterestdl'];
  usage = '!pin <url de pinterest>';
  examples = ['!pin https://pin.it/...'];
  cooldown = 60000;
  contexts = [CommandContext.BOTH];
  mediaGroup = true;

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args.join(' ').trim();

    if (!url) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *Pinterest Downloader* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *cómo usar:*\n` +
          `  ﹒!pin <url de pinterest>\n\n` +
          `✩ *ejemplo:*\n` +
          `  ﹒!pin https://pin.it/abc123`,
      );
      return;
    }

    if (!url.includes('pinterest')) {
      await ctx.reply('❌ La URL debe ser de Pinterest');
      return;
    }

    await ctx.react('🔍');
    await ctx.reply(`🔍 Obteniendo contenido de Pinterest...`);

    try {
      const result = await pinterestDownloader.getMedia(url);

      if (!result.ok || !result.media || result.media.length === 0) {
        await ctx.react('❌');
        await ctx.reply(`❌ No se encontró contenido descargable`);
        return;
      }

      const media = result.media[0];

      if (media.type === 'image') {
        const dlResult = await pinterestDownloader.downloadImage(media.url);

        if (dlResult.ok && dlResult.filePath) {
          await ctx.sock.sendMessage(
            ctx.chat.jid,
            {
              image: { url: dlResult.filePath },
              caption: '📌 Pinterest',
            },
            { quoted: ctx.message },
          );
          pinterestDownloader.cleanup(dlResult.filePath);
          await ctx.react('✅');
        } else {
          await ctx.reply(`📌 *Pinterest*\n\n🔗 ${media.url}`);
        }
      } else {
        await ctx.reply(`📌 *Pinterest Video*\n\n🔗 ${media.url}`);
      }
    } catch (error) {
      console.error('PinterestCommand error:', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al descargar de Pinterest');
    }
  }
}
