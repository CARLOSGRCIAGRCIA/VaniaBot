import { Command } from '../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { downloadMediaMessage } from '@whiskeysockets/baileys';

export class StickerCommand extends Command {
  name = 'sticker';
  description = 'Convierte imagen/video a sticker';
  category = CommandCategory.MEDIA;
  aliases = ['s', 'stiker'];
  usage = '!sticker <responde a imagen/video>';
  examples = ['!sticker', '!s'];

  async execute(ctx: MessageContext): Promise<void> {
    const quotedMsg = ctx.message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    
    if (!quotedMsg?.imageMessage && !quotedMsg?.videoMessage) {
      await ctx.reply('❌ Responde a una imagen o video');
      return;
    }

    await ctx.react('⏳');

    try {
      const buffer = await downloadMediaMessage(
        { message: quotedMsg } as any,
        'buffer',
        {}
      );

      await ctx.sock.sendMessage(ctx.chat.jid, {
        sticker: buffer,
      });

      await ctx.react('✅');
    } catch (error) {
      await ctx.reply('❌ Error al crear el sticker');
      await ctx.react('❌');
    }
  }
}