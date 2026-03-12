import { Command } from '../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { StickerService } from '@/services/media/StickerService.js';
import type { proto } from '@whiskeysockets/baileys';

export class StickerCommand extends Command {
  name = 'sticker';
  description = 'Convert image/video to sticker';
  category = CommandCategory.MEDIA;
  aliases = ['s', 'stiker'];
  usage = '!sticker <reply to image/video>';
  examples = ['!sticker', '!s'];
  contexts = [CommandContext.BOTH];

  private stickerService: StickerService;

  constructor() {
    super();
    this.stickerService = new StickerService();
  }

  async execute(ctx: MessageContext): Promise<void> {
    const quotedMsg = ctx.message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!quotedMsg) {
      await ctx.reply(
        ' Reply to an image or video\n\n' +
          'Usage: Reply to a photo/video with !sticker\n' +
          '💡 Videos must be less than 10 seconds',
      );
      return;
    }

    const hasImage = quotedMsg.imageMessage;
    const hasVideo = quotedMsg.videoMessage;

    if (!hasImage && !hasVideo) {
      await ctx.reply(
        ' Reply to an image or video\n\n' +
          '✅ Supported: JPG, PNG, WebP, MP4, GIF\n' +
          '⏱️ Max video: 10 seconds',
      );
      return;
    }

    await ctx.react('⏳');

    try {
      const fakeMsg = { message: quotedMsg } as proto.IWebMessageInfo;

      const buffer = await downloadMediaMessage(fakeMsg, 'buffer', {});

      const stickerBuffer = await this.stickerService.createSticker(buffer, {
        pack: '𝙑𝙖𝙣𝙞𝙖𝘽𝙤𝙩 💝',
        author: '𝙑𝙖𝙣𝙞𝙖𝘽𝙤𝙩 💝 𝘾𝙖𝙧𝙡𝙤𝙨 𝙂',
        categories: ['💝'],
      });

      await ctx.sock.sendMessage(ctx.chat.jid, {
        sticker: stickerBuffer,
      });

      await ctx.react('✅');
    } catch (error) {
      console.error('Error in StickerCommand:', error);
    }
  }
}
