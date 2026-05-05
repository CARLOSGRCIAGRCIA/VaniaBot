import { Command } from '../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { StickerHelper } from '@/utils/StickerHelper.js';
import type { proto } from '@whiskeysockets/baileys';

export class StickerCommand extends Command {
  name = 'sticker';
  description = 'Convert image/video to sticker';
  category = CommandCategory.MEDIA;
  aliases = ['s'];
  usage = '!sticker <reply to image/video>';
  examples = ['!sticker', '!s'];
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    const quotedMsg = ctx.message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const directMsg = ctx.message.message;

    const hasQuotedMedia = quotedMsg?.imageMessage || quotedMsg?.videoMessage;
    const hasDirectMedia = directMsg?.imageMessage || directMsg?.videoMessage;

    if (!hasQuotedMedia && !hasDirectMedia) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *oops, necesito una imagen o video* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ responde a una foto/video con *!sticker*\n` +
          `✩ videos cortitos, menos de 10 segundos ✩`,
      );
      return;
    }

    await ctx.react('⏳');

    try {
      const targetMsg: proto.IWebMessageInfo = hasQuotedMedia
        ? ({ message: quotedMsg } as proto.IWebMessageInfo)
        : ctx.message;

      const buffer = await downloadMediaMessage(targetMsg, 'buffer', {});
      const stickerBuffer = await StickerHelper.createSticker(buffer as Buffer);

      await ctx.sock.sendMessage(ctx.chat.jid, { sticker: stickerBuffer });
      await ctx.react('✅');
    } catch (error) {
      logError('[StickerCommand] Error', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude convertir el sticker, intenta de nuevo.');
    }
  }
}
