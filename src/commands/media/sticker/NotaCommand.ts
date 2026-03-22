import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { StickerService } from '@/services/media/StickerService.js';
import type { Sharp } from 'sharp';
import path from 'path';

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

    const words = ctx.args.slice(0, 20);
    const text = words.join(' ');

    await ctx.react('⏳');

    try {
      let sharpFn: (input: string) => Sharp;
      try {
        sharpFn = (await import('sharp')).default as (input: string) => Sharp;
      } catch {
        await ctx.reply(
          '❌ Este comando no está disponible en esta plataforma (sharp no instalado)',
        );
        await ctx.react('❌');
        return;
      }

      const imagePath = path.join(process.cwd(), 'data', 'assets', 'nota.jpg');

      const image = sharpFn(imagePath);
      const metadata = await image.metadata();

      const width = metadata.width || 512;
      const height = metadata.height || 512;

      const fontSize = 99;
      const textColor = '#1a1a1a';

      const x = width / 2;
      const centerY = height / 2;

      const maxCharsPerLine = 15;
      const lines = this.wrapText(text, maxCharsPerLine);
      const lineHeight = fontSize + 15;

      const totalHeight = lines.length * lineHeight;
      const startY = centerY - totalHeight / 2 + fontSize / 2;

      let svgContent = `<svg width="${width}" height="${height}">`;

      lines.forEach((line, index) => {
        const currentY = startY + index * lineHeight;
        svgContent += `
          <text 
            x="${x}" 
            y="${currentY}" 
            font-family="Comic Sans MS, cursive, Arial, sans-serif" 
            font-size="${fontSize}" 
            font-weight="bold" 
            fill="${textColor}" 
            text-anchor="middle"
          >${this.escapeXml(line)}</text>
        `;
      });

      svgContent += `</svg>`;

      const buffer = await image
        .composite([{ input: Buffer.from(svgContent), top: 0, left: 0 }])
        .png()
        .toBuffer();

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
