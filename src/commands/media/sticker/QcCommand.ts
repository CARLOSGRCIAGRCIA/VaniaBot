import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { StickerService } from '@/services/media/StickerService.js';
import { ImageProcessor } from '@/utils/imageProcessor.js';
import { primeService } from '@/services/system/PrimeService.js';
import axios from 'axios';

export class QcCommand extends Command {
  name = 'qc';
  description = 'Create a quote sticker with text and profile picture';
  category = CommandCategory.MEDIA;
  aliases = ['quote'];
  usage = '!qc <text>';
  examples = ['!qc Hello World', '!qc @user Your text here'];
  cooldown = 5000;

  private stickerService: StickerService;

  constructor() {
    super();
    this.stickerService = new StickerService();
  }

  async execute(ctx: MessageContext): Promise<void> {
    let text: string;

    if (ctx.args.length >= 1) {
      text = ctx.args.join(' ');
    } else if (ctx.quoted?.conversation || ctx.quoted?.extendedTextMessage?.text) {
      text = ctx.quoted.conversation || ctx.quoted.extendedTextMessage?.text || '';
    } else {
      await ctx.reply('Missing text!\n\nUsage: !qc <text>');
      return;
    }

    if (!text) {
      await ctx.reply('Missing text!');
      return;
    }

    const mentionedJid = ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const targetJid = mentionedJid || ctx.sender.jid;
    const cleanNumber = targetJid.split('@')[0];
    const mentionRegex = new RegExp(
      `@${cleanNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`,
      'g',
    );
    const cleanText = text.replace(mentionRegex, '').trim();

    if (cleanText.length > 40) {
      await ctx.reply('Text cannot exceed 40 characters');
      return;
    }

    await ctx.react('⏳');

    try {
      let pp = 'https://telegra.ph/file/24fa902ead26340f3df2c.png';
      try {
        const profilePic = await ctx.sock.profilePictureUrl(targetJid, 'image');
        if (profilePic) pp = profilePic;
      } catch {
        // Sin foto de perfil, usa el default
      }

      const nombre = ctx.sender.pushName || 'User';

      let imageBuffer: Buffer | null = null;
      try {
        const obj = {
          type: 'quote',
          format: 'png',
          backgroundColor: '#000000',
          width: 512,
          height: 768,
          scale: 2,
          messages: [
            {
              entities: [],
              avatar: true,
              from: { id: 1, name: nombre, photo: { url: pp } },
              text: cleanText,
              replyMessage: {},
            },
          ],
        };
        const res = await axios.post('https://bot.lyo.su/quote/generate', obj, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 8000,
        });
        imageBuffer = Buffer.from(res.data.result.image, 'base64');
      } catch {
        // API caída o timeout — usa fallback local
      }

      if (!imageBuffer) {
        imageBuffer = await this.buildLocalQuoteImage(nombre, cleanText, pp);
      }

      const resizedBuffer = await ImageProcessor.resizeImage(imageBuffer, 512, 512);
      const stickerInfo = await primeService.formatStickerInfo(
        ctx.sock,
        ctx.chat.jid,
        ctx.chat.isGroup,
      );

      const stiker = await this.stickerService.createSticker(resizedBuffer, {
        pack: stickerInfo.pack,
        author: stickerInfo.author,
      });

      await ctx.sock.sendMessage(ctx.chat.jid, { sticker: stiker });
      await ctx.react('✅');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await ctx.reply(`❌ Error: ${message}`);
      await ctx.react('❌');
    }
  }

  /**
   * Genera una quote card simple usando solo SVG + FFmpeg (sin sharp).
   * Descarga la foto de perfil si está disponible; si no, usa un círculo de color.
   */
  private async buildLocalQuoteImage(name: string, text: string, ppUrl: string): Promise<Buffer> {
    const width = 512;
    const height = 512;

    let ppDataUri = '';
    try {
      const resp = await axios.get(ppUrl, { responseType: 'arraybuffer', timeout: 5000 });
      const b64 = Buffer.from(resp.data as ArrayBuffer).toString('base64');
      const mime = (resp.headers['content-type'] as string) || 'image/jpeg';
      ppDataUri = `data:${mime};base64,${b64}`;
    } catch {
      // Sin imagen de perfil
    }

    const escapedName = this.escapeXml(name);
    const escapedText = this.escapeXml(text);

    const avatarBlock = ppDataUri
      ? `
        <defs>
          <clipPath id="avatarClip">
            <circle cx="80" cy="80" r="48"/>
          </clipPath>
        </defs>
        <image href="${ppDataUri}" x="32" y="32" width="96" height="96" clip-path="url(#avatarClip)"/>
      `
      : `
        <circle cx="80" cy="80" r="48" fill="#7C3AED"/>
        <text x="80" y="95" font-family="Arial" font-size="40" font-weight="bold" fill="white" text-anchor="middle">${escapedName.charAt(0).toUpperCase()}</text>
      `;

    const lines = this.wrapText(escapedText, 22);
    let textRows = '';
    lines.forEach((line, i) => {
      textRows += `<text x="256" y="${220 + i * 48}" font-family="Arial, sans-serif" font-size="34" fill="white" text-anchor="middle">${line}</text>`;
    });

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <!-- Fondo degradado oscuro -->
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1a1a2e"/>
          <stop offset="100%" stop-color="#16213e"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)" rx="24"/>

      <!-- Comillas decorativas -->
      <text x="30" y="175" font-family="Georgia, serif" font-size="120" fill="#7C3AED" opacity="0.4">"</text>
      <text x="420" y="350" font-family="Georgia, serif" font-size="120" fill="#7C3AED" opacity="0.4">"</text>

      <!-- Avatar -->
      ${avatarBlock}

      <!-- Nombre -->
      <text x="152" y="68" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white">${escapedName}</text>
      <text x="152" y="98" font-family="Arial, sans-serif" font-size="20" fill="#a0a0c0">@${escapedName.toLowerCase().replace(/\s+/g, '')}</text>

      <!-- Línea separadora -->
      <line x1="40" y1="145" x2="472" y2="145" stroke="#7C3AED" stroke-width="2" opacity="0.5"/>

      <!-- Texto de la cita -->
      ${textRows}

      <!-- Footer -->
      <text x="256" y="480" font-family="Arial, sans-serif" font-size="18" fill="#6060a0" text-anchor="middle">VaniaBot 💝</text>
    </svg>`;

    const { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync } = await import('fs');
    const { join } = await import('path');
    const { spawn } = await import('child_process');

    const tempDir = './data/temp';
    if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });

    const ts = Date.now();
    const svgPath = join(tempDir, `qc-svg-${ts}.svg`);
    const pngPath = join(tempDir, `qc-png-${ts}.png`);

    writeFileSync(svgPath, svg, 'utf8');

    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('ffmpeg', ['-y', '-i', svgPath, pngPath]);
        let stderr = '';
        proc.stderr.on('data', d => (stderr += d.toString()));
        proc.on('close', code =>
          code === 0 ? resolve() : reject(new Error(`FFmpeg SVG→PNG: ${stderr.slice(-300)}`)),
        );
        proc.on('error', reject);
      });

      const buf = readFileSync(pngPath);
      try {
        unlinkSync(svgPath);
      } catch {}
      try {
        unlinkSync(pngPath);
      } catch {}
      return buf;
    } catch {
      try {
        unlinkSync(svgPath);
      } catch {}
      return Buffer.from(svg, 'utf8');
    }
  }

  private wrapText(text: string, maxChars: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    words.forEach(word => {
      if ((currentLine + word).length <= maxChars) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });
    if (currentLine) lines.push(currentLine);
    return lines.length > 0 ? lines : [text];
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
