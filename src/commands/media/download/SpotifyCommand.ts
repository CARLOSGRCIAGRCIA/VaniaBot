/**
 * @fileoverview SpotifyCommand.ts - Download music from Spotify
 *
 * Searches and downloads music from Spotify using dvyer-api.
 *
 * @module commands/media/download/SpotifyCommand
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { spotifyService } from '@/services/download/SpotifyService.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';

const TMP_DIR = path.join(os.tmpdir(), 'vaniabot-spotify');

export class SpotifyCommand extends Command {
  name = 'spotify';
  description = 'Descarga música de Spotify';
  category = CommandCategory.MEDIA;
  aliases = ['sp', 'spot', 'music'];
  usage = '!sp <canción> o !sp <url de Spotify>';
  examples = ['!sp believer imagine dragons', '!sp https://open.spotify.com/track/...'];
  cooldown = 60000;
  contexts = [CommandContext.BOTH];
  mediaGroup = true;

  private async ensureTmpDir(): Promise<void> {
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true });
    }
  }

  private async downloadFile(url: string, filename: string): Promise<string | null> {
    try {
      await this.ensureTmpDir();
      const tempPath = path.join(TMP_DIR, `${Date.now()}-${filename}.mp3`);

      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 120000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      fs.writeFileSync(tempPath, Buffer.from(response.data));
      return tempPath;
    } catch {
      return null;
    }
  }

  async execute(ctx: MessageContext): Promise<void> {
    const input = ctx.args.join(' ').trim();

    if (!input) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *Spotify Downloader* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *cómo usar:*\n` +
          `  ﹒!sp <nombre de canción>\n` +
          `  ﹒!sp <url de spotify>\n\n` +
          `✩ *ejemplos:*\n` +
          `  ﹒!sp believer imagine dragons\n` +
          `  ﹒!sp https://open.spotify.com/track/...`,
      );
      return;
    }

    await ctx.react('🔍');
    await ctx.reply(`🔍 Buscando en Spotify: "${input}"...`);

    try {
      const result = await spotifyService.search(input, 5);

      if (!result.ok || !result.results || result.results.length === 0) {
        await ctx.react('❌');
        await ctx.reply(`❌ No se encontraron resultados para: *${input}*`);
        return;
      }

      const first = result.results[0];
      let downloadUrl = result.download_url;

      if (!downloadUrl) {
        const dlResult = await spotifyService.getDownloadUrl(input);
        downloadUrl = dlResult.download_url;
      }

      const caption = `🎵 *${first.title}*\n👤 ${first.artist || 'Artista desconocido'}`;

      if (downloadUrl) {
        await ctx.react('⬇️');
        await ctx.reply(`⬇️ Descargando: ${first.title}...`);

        const filePath = await this.downloadFile(downloadUrl, first.title);

        if (filePath && fs.existsSync(filePath)) {
          const stat = fs.statSync(filePath);
          if (stat.size < 60 * 1024 * 1024) {
            await ctx.sock.sendMessage(
              ctx.chat.jid,
              {
                audio: { url: filePath },
                mimetype: 'audio/mpeg',
                ptt: false,
              },
              { quoted: ctx.message },
            );
          } else {
            await ctx.sock.sendMessage(
              ctx.chat.jid,
              {
                document: { url: filePath },
                mimetype: 'audio/mpeg',
                fileName: `${first.title}.mp3`,
                caption: caption,
              },
              { quoted: ctx.message },
            );
          }

          fs.unlinkSync(filePath);
          await ctx.react('✅');
        } else {
          await ctx.reply(`${caption}\n\n🔗 ${downloadUrl}`);
        }
      } else {
        let text = `🎵 *Resultados para:* ${input}\n`;
        text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

        result.results.slice(0, 5).forEach((track, i) => {
          text += `🎵 *${i + 1}.* ${track.title}\n`;
          text += `   👤 ${track.artist || 'Desconocido'}\n`;
          if (track.album) text += `   💿 ${track.album}\n`;
          text += '\n';
        });

        text += `━━━━━━━━━━━━━━━━━━━━\n`;
        text += `✦ Usa *!sp <nombre>* para descargar`;

        await ctx.reply(text);
      }
    } catch (error) {
      console.error('SpotifyCommand error:', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar/descargar de Spotify');
    }
  }
}
