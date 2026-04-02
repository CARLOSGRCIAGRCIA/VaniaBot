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
          // Pedir 512x512 directamente para evitar resize que corta la imagen
          width: 512,
          height: 512,
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

      // contain: escala sin recortar, rellena con transparente si hace falta
      const resizedBuffer = await ImageProcessor.resizeContain(imageBuffer, 512, 512);

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
   * Quote card 512x512, avatar centrado arriba, texto centrado abajo.
   * Layout diseñado para verse bien como sticker de WhatsApp.
   */
  private async buildLocalQuoteImage(name: string, text: string, ppUrl: string): Promise<Buffer> {
    const W = 512;
    const H = 512;

    let ppDataUri = '';
    try {
      const resp = await axios.get(ppUrl, { responseType: 'arraybuffer', timeout: 5000 });
      const b64 = Buffer.from(resp.data as ArrayBuffer).toString('base64');
      const mime = (resp.headers['content-type'] as string) || 'image/jpeg';
      ppDataUri = `data:${mime};base64,${b64}`;
    } catch {
      // sin foto — usará inicial
    }

    const eName = this.escapeXml(name);
    const eText = this.escapeXml(text);

    const AV_CX = W / 2;
    const AV_CY = 115;
    const AV_R = 58;

    const avatarBlock = ppDataUri
      ? `<defs>
          <clipPath id="av">
            <circle cx="${AV_CX}" cy="${AV_CY}" r="${AV_R}"/>
          </clipPath>
        </defs>
        <circle cx="${AV_CX}" cy="${AV_CY}" r="${AV_R + 4}" fill="#7C3AED" opacity="0.5"/>
        <image href="${ppDataUri}"
          x="${AV_CX - AV_R}" y="${AV_CY - AV_R}"
          width="${AV_R * 2}" height="${AV_R * 2}"
          clip-path="url(#av)"/>`
      : `<circle cx="${AV_CX}" cy="${AV_CY}" r="${AV_R}" fill="#7C3AED"/>
         <text x="${AV_CX}" y="${AV_CY + 20}"
           font-family="Arial" font-size="52" font-weight="bold"
           fill="white" text-anchor="middle">${eName.charAt(0).toUpperCase()}</text>`;

    const NAME_Y = AV_CY + AV_R + 36;
    const SEP_Y = NAME_Y + 20;
    const TEXT_BASE = SEP_Y + 42;
    const LINE_H = 48;

    const lines = this.wrapText(eText, 19);
    const textRows = lines
      .map(
        (line, i) =>
          `<text x="${W / 2}" y="${TEXT_BASE + i * LINE_H}"
            font-family="Arial, sans-serif" font-size="38"
            fill="white" text-anchor="middle">${line}</text>`,
      )
      .join('\n');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="#1a1a2e"/>
          <stop offset="100%" stop-color="#0f0f1a"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#bg)" rx="30"/>

      <!-- Comillas decorativas -->
      <text x="20" y="78" font-family="Georgia,serif" font-size="96"
        fill="#7C3AED" opacity="0.3">"</text>
      <text x="${W - 38}" y="${H - 14}" font-family="Georgia,serif" font-size="96"
        fill="#7C3AED" opacity="0.3">"</text>

      ${avatarBlock}

      <!-- Nombre -->
      <text x="${W / 2}" y="${NAME_Y}"
        font-family="Arial,sans-serif" font-size="26" font-weight="bold"
        fill="#C084FC" text-anchor="middle">${eName}</text>

      <!-- Separador -->
      <line x1="80" y1="${SEP_Y}" x2="${W - 80}" y2="${SEP_Y}"
        stroke="#7C3AED" stroke-width="1.5" opacity="0.6"/>

      <!-- Texto de la cita -->
      ${textRows}

      <!-- Footer -->
      <text x="${W / 2}" y="${H - 16}"
        font-family="Arial,sans-serif" font-size="15"
        fill="#3a3a6a" text-anchor="middle">VaniaBot</text>
    </svg>`;

    return await ImageProcessor.svgToBuffer(svg, W, H);
  }

  private wrapText(text: string, maxChars: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length <= maxChars) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
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
