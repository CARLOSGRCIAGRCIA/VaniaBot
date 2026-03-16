import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { StickerService } from '@/services/media/StickerService.js';
import path, { join } from 'path';

export class PatCommand extends Command {
  name = 'pat';
  description = 'Create a Patrick meme sticker';
  category = CommandCategory.MEDIA;
  aliases = ['patrick'];
  usage = '!pat <text>';
  examples = ['!pat Hello 🤣', '!pat This is funny'];
  cooldown = 5000;

  private stickerService: StickerService;

  constructor() {
    super();
    this.stickerService = new StickerService();
  }

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args.length) {
      await ctx.reply('⚠️ Write something after .pat\nExample: *!pat Hello 🤣*');
      return;
    }

    const text = ctx.args.slice(0, 20).join(' ');
    await ctx.react('⏳');

    try {
      const randomNum = Math.floor(Math.random() * 4) + 1;
      const buffer = await this.composeImage(`pat${randomNum}.jpg`, text);

      const stiker = await this.stickerService.createSticker(buffer, {
        pack: 'VaniaBot',
        author: 'VaniaBot',
      });

      await ctx.sock.sendMessage(ctx.chat.jid, { sticker: stiker });
      await ctx.react('✅');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await ctx.reply(`❌ Error: ${message}`);
    }
  }

  private async composeImage(filename: string, text: string): Promise<Buffer> {
    const imagePath = path.join(process.cwd(), 'data', 'assets', filename);

    try {
      const sharp = (await import('sharp')).default;
      return await this.composeWithSharp(sharp, imagePath, text);
    } catch {
      return await this.composeWithJimp(imagePath, text);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async composeWithSharp(sharp: any, imagePath: string, text: string): Promise<Buffer> {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    const width = metadata.width || 512;
    const height = metadata.height || 512;
    const fontSize = 95;
    const x = width / 2;
    const y = height - 100;
    const lines = this.wrapText(text, 20);
    const lineHeight = fontSize + 10;
    const startY = y - ((lines.length - 1) * lineHeight) / 2;

    let svg = `<svg width="${width}" height="${height}">`;
    lines.forEach((line, i) => {
      const cy = startY + i * lineHeight;
      const escaped = this.escapeXml(line);
      const base = `font-family="Impact, Arial Black, sans-serif" font-size="${fontSize}" font-weight="bold" text-anchor="middle"`;
      svg += `<text x="${x - 4}" y="${cy}" ${base} fill="#000000">${escaped}</text>`;
      svg += `<text x="${x + 4}" y="${cy}" ${base} fill="#000000">${escaped}</text>`;
      svg += `<text x="${x}" y="${cy - 4}" ${base} fill="#000000">${escaped}</text>`;
      svg += `<text x="${x}" y="${cy + 4}" ${base} fill="#000000">${escaped}</text>`;
      svg += `<text x="${x}" y="${cy}" ${base} fill="#FFFFFF">${escaped}</text>`;
    });
    svg += `</svg>`;

    return await image
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .png()
      .toBuffer();
  }

  private async composeWithJimp(imagePath: string, text: string): Promise<Buffer> {
    const { Jimp, loadFont, HorizontalAlign, VerticalAlign } = await import('jimp');

    const image = await Jimp.read(imagePath);
    image.resize({ w: 512, h: 512 });

    const fontPath = join(
      process.cwd(),
      'node_modules/@jimp/plugin-print/fonts/open-sans/open-sans-64-white/open-sans-64-white.fnt',
    );
    const font = await loadFont(fontPath);

    // Texto en la parte inferior como meme
    image.print({
      font,
      x: 0,
      y: 512 - 140,
      text: {
        text,
        alignmentX: HorizontalAlign.CENTER,
        alignmentY: VerticalAlign.MIDDLE,
      },
      maxWidth: 512,
      maxHeight: 140,
    });

    return await image.getBuffer('image/png');
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
