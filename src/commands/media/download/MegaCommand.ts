/**
 * @fileoverview MegaCommand.ts - Download from Mega.nz
 *
 * Downloads files from Mega.nz using megajs.
 *
 * @module commands/media/download/MegaCommand
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { megaDownloader } from '@/services/download/MegaDownloader.js';

export class MegaCommand extends Command {
  name = 'mega';
  description = 'Descarga archivos de Mega.nz';
  category = CommandCategory.MEDIA;
  aliases = ['megadl'];
  usage = '!mega <url de mega>';
  examples = ['!mega https://mega.nz/file/...'];
  cooldown = 300000;
  contexts = [CommandContext.BOTH];
  mediaGroup = true;

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args.join(' ').trim();

    if (!url) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *Mega Downloader* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *cómo usar:*\n` +
          `  ﹒!mega <url de mega>\n\n` +
          `✩ *ejemplo:*\n` +
          `  ﹒!mega https://mega.nz/file/abc123`,
      );
      return;
    }

    if (!url.includes('mega')) {
      await ctx.reply('❌ La URL debe ser de Mega.nz');
      return;
    }

    await ctx.react('🔍');
    await ctx.reply(`🔍 Obteniendo info de Mega...`);

    try {
      const info = await megaDownloader.getInfo(url);

      if (!info) {
        await ctx.react('❌');
        await ctx.reply('❌ No se pudo obtener info del archivo');
        return;
      }

      await ctx.reply(`📥 Descargando: ${info.name}...`);

      const result = await megaDownloader.download(url);

      if (!result.ok || !result.filePath) {
        await ctx.react('❌');
        await ctx.reply(`❌ ${result.error || 'Error al descargar'}`);
        return;
      }

      const isVideo = /\.(mp4|mkv|avi|mov)$/i.test(result.name || '');
      const isAudio = /\.(mp3|wav|ogg|flac)$/i.test(result.name || '');
      const sizeMB = ((result.size || 0) / (1024 * 1024)).toFixed(2);

      if (isVideo) {
        const caption = `📁 *${result.name}*\n💾 ${sizeMB} MB\n📦 Mega.nz`;
        if ((result.size || 0) > 60 * 1024 * 1024) {
          await ctx.sock.sendMessage(
            ctx.chat.jid,
            {
              document: { url: result.filePath },
              mimetype: 'video/mp4',
              fileName: result.name,
              caption: caption,
            },
            { quoted: ctx.message },
          );
        } else {
          await ctx.sock.sendMessage(
            ctx.chat.jid,
            {
              video: { url: result.filePath },
              caption: caption,
            },
            { quoted: ctx.message },
          );
        }
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
            fileName: result.name,
            caption: `📁 *${result.name}*\n💾 ${sizeMB} MB\n📦 Mega.nz`,
          },
          { quoted: ctx.message },
        );
      }

      megaDownloader.cleanup(result.filePath);
      await ctx.react('✅');
    } catch (error) {
      console.error('MegaCommand error:', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al descargar de Mega.nz');
    }
  }
}
