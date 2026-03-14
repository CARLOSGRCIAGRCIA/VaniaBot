import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { StickerService } from '@/services/media/StickerService.js';
import path, { join } from 'path';

export class NotaCommand extends Command {
  name = 'nota';
  description = 'Create a note sticker with text';
  category = CommandCategory.MEDIA;
  aliases = ['note'];
  usage = '!nota <text>';
  examples = ['!nota Hello World', '!nota Remember this'];
  cooldown = 5000;

  private stickerService: StickerService;

  constructor() {
    super();
    this.stickerService = new StickerService();
  }

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args.length) {
      await ctx.reply('⚠️ Write something after .nota\nExample: *!nota Hello*');
      return;
    }

    const text = ctx.args.slice(0, 20).join(' ');
    await ctx.react('⏳');

    try {
      const buffer = await this.composeImage('nota.jpg', text);

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

  private async composeWithSharp(sharp: any, imagePath: string, text: string): Promise<Buffer> {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    const width = metadata.width || 512;
    const height = metadata.height || 512;

    const fontSize = 99;
    const textColor = '#1a1a1a';
    const x = width / 2;
    const lines = this.wrapText(text, 15);
    const lineHeight = fontSize + 15;
    const totalHeight = lines.length * lineHeight;
    const startY = height / 2 - totalHeight / 2 + fontSize / 2;

    let svgContent = `<svg width="${width}" height="${height}">`;
    lines.forEach((line, i) => {
      svgContent += `<text x="${x}" y="${startY + i * lineHeight}" font-family="Comic Sans MS, cursive, Arial" font-size="${fontSize}" font-weight="bold" fill="${textColor}" text-anchor="middle">${this.escapeXml(line)}</text>`;
    });
    svgContent += `</svg>`;

    return await image
      .composite([{ input: Buffer.from(svgContent), top: 0, left: 0 }])
      .png()
      .toBuffer();
  }

  private async composeWithJimp(imagePath: string, text: string): Promise<Buffer> {
    const { Jimp, loadFont, HorizontalAlign, VerticalAlign } = await import('jimp');

    const image = await Jimp.read(imagePath);
    image.resize({ w: 512, h: 512 });

    const fontPath = join(
      process.cwd(),
      'node_modules/@jimp/plugin-print/fonts/open-sans/open-sans-64-black/open-sans-64-black.fnt',
    );
    const font = await loadFont(fontPath);

    image.print({
      font,
      x: 0,
      y: 0,
      text: {
        text,
        alignmentX: HorizontalAlign.CENTER,
        alignmentY: VerticalAlign.MIDDLE,
      },
      maxWidth: 512,
      maxHeight: 512,
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
