/**
 * @fileoverview MediafireCommand.ts - Download from Mediafire
 *
 * Downloads files from Mediafire.
 *
 * @module commands/media/download/MediafireCommand
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { mediafireDownloader } from '@/services/download/MediafireDownloader.js';

export class MediafireCommand extends Command {
  name = 'mediafire';
  description = 'Descarga archivos de Mediafire';
  category = CommandCategory.MEDIA;
  aliases = ['mf', 'mediafiledl'];
  usage = '!mf <url de mediafire>';
  examples = ['!mf https://www.mediafire.com/file/...'];
  cooldown = 300000;
  contexts = [CommandContext.BOTH];
  mediaGroup = true;

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args.join(' ').trim();

    if (!url) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *Mediafire Downloader* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *cómo usar:*\n` +
          `  ﹒!mf <url de mediafire>\n\n` +
          `✩ *ejemplo:*\n` +
          `  ﹒!mf https://www.mediafire.com/file/abc123`,
      );
      return;
    }

    if (!url.includes('mediafire')) {
      await ctx.reply('❌ La URL debe ser de Mediafire');
      return;
    }

    await ctx.react('🔍');
    await ctx.reply(`🔍 Obteniendo info de Mediafire...`);

    try {
      const info = await mediafireDownloader.getInfo(url);

      if (!info.ok || !info.url) {
        await ctx.react('❌');
        await ctx.reply(`❌ ${info.error || 'No se pudo obtener info del archivo'}`);
        return;
      }

      await ctx.reply(`📥 Descargando: ${info.filename}...`);

      const result = await mediafireDownloader.download(url);

      if (!result.ok || !result.filePath) {
        await ctx.react('❌');
        await ctx.reply(
          `❌ ${result.error || 'Error al descargar'}\n\n🔗 Enlace directo:\n${info.url}`,
        );
        return;
      }

      const isVideo = /\.(mp4|mkv|avi|mov)$/i.test(result.filename || '');
      const isAudio = /\.(mp3|wav|ogg|flac)$/i.test(result.filename || '');

      if (isVideo) {
        const caption = `📁 *${result.filename}*\n💾 ${result.size || 'Desconocido'}\n📦 Mediafire`;
        await ctx.sock.sendMessage(
          ctx.chat.jid,
          {
            video: { url: result.filePath },
            caption: caption,
          },
          { quoted: ctx.message },
        );
      } else if (isAudio) {
        await ctx.sock.sendMessage(
          ctx.chat.jid,
          {
            audio: { url: result.filePath },
            mimetype: 'audio/mpeg',
            ptt: false,
          },
          { quoted: ctx.message },
        );
      } else {
        await ctx.sock.sendMessage(
          ctx.chat.jid,
          {
            document: { url: result.filePath },
            mimetype: 'application/octet-stream',
            fileName: result.filename,
            caption: `📁 *${result.filename}*\n💾 ${result.size || 'Desconocido'}\n📦 Mediafire`,
          },
          { quoted: ctx.message },
        );
      }

      mediafireDownloader.cleanup(result.filePath);
      await ctx.react('✅');
    } catch (error) {
      console.error('MediafireCommand error:', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al descargar de Mediafire');
    }
  }
}
