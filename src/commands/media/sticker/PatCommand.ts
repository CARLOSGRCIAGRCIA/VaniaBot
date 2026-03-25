import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { StickerService } from '@/services/media/StickerService.js';
import { ImageProcessor } from '@/utils/imageProcessor.js';
import path from 'path';

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
      await ctx.reply('⚠️ Escribe algo después de .pat\nEjemplo: *!pat Hola 🤣*');
      return;
    }

    const text = ctx.args.slice(0, 20).join(' ');
    await ctx.react('⏳');

    try {
      const randomNum = Math.floor(Math.random() * 4) + 1;
      const imagePath = path.join(process.cwd(), 'data', 'assets', `pat${randomNum}.jpg`);
      const { width, height } = await ImageProcessor.loadImage(imagePath);

      const fontSize = 95;
      const textColor = '#FFFFFF';
      const shadowColor = '#000000';
      const shadowOffset = 4;
      const x = width / 2;
      const y = height - 100;
      const maxCharsPerLine = 20;
      const lines = this.wrapText(text, maxCharsPerLine);
      const lineHeight = fontSize + 10;
      const startY = y - ((lines.length - 1) * lineHeight) / 2;

      let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;
      lines.forEach((line, index) => {
        const currentY = startY + index * lineHeight;
        const escaped = this.escapeXml(line);
        // Sombra en 4 direcciones + texto principal (estilo meme clásico)
        svgContent += `
          <text x="${x - shadowOffset}" y="${currentY}" font-family="Impact, Arial Black, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${shadowColor}" text-anchor="middle">${escaped}</text>
          <text x="${x + shadowOffset}" y="${currentY}" font-family="Impact, Arial Black, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${shadowColor}" text-anchor="middle">${escaped}</text>
          <text x="${x}" y="${currentY - shadowOffset}" font-family="Impact, Arial Black, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${shadowColor}" text-anchor="middle">${escaped}</text>
          <text x="${x}" y="${currentY + shadowOffset}" font-family="Impact, Arial Black, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${shadowColor}" text-anchor="middle">${escaped}</text>
          <text x="${x}" y="${currentY}" font-family="Impact, Arial Black, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${textColor}" text-anchor="middle">${escaped}</text>
        `;
      });
      svgContent += `</svg>`;

      const buffer = await ImageProcessor.compositeText(imagePath, svgContent, width, height);

      const stiker = await this.stickerService.createSticker(buffer, {
        pack: 'VaniaBot',
        author: 'VaniaBot',
      });

      await ctx.sock.sendMessage(ctx.chat.jid, { sticker: stiker });
      await ctx.react('✅');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await ctx.reply(`❌ Error: ${message}`);
      await ctx.react('❌');
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
