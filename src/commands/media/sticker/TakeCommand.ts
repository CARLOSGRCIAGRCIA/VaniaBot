import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { StickerService } from '@/services/media/StickerService.js';
import type { proto } from '@whiskeysockets/baileys';

export class TakeCommand extends Command {
  name = 'take';
  description = 'Change sticker pack name and author';
  category = CommandCategory.MEDIA;
  aliases = ['steal', 'wm', 'robar'];
  usage = '!take <packname>|<author>';
  examples = ['!take VaniaBot|Carlos', '!take MyPack|MyName'];
  cooldown = 3000;

  private stickerService: StickerService;

  constructor() {
    super();
    this.stickerService = new StickerService();
  }

  async execute(ctx: MessageContext): Promise<void> {
    const quotedMsg = ctx.message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!quotedMsg || !quotedMsg.stickerMessage) {
      await ctx.reply('⚠️ *Reply to a sticker!*');
      return;
    }

    const text = ctx.args.join(' ');
    const [packname = 'VaniaBot', ...authorParts] = text.split('|');
    const author = authorParts.join('|') || 'VaniaBot';

    await ctx.react('⏳');

    try {
      const fakeMsg = { message: quotedMsg } as proto.IWebMessageInfo;
      const buffer = await downloadMediaMessage(fakeMsg, 'buffer', {});

      const stiker = await this.stickerService.addExif(buffer, packname.trim(), author.trim());

      await ctx.sock.sendMessage(ctx.chat.jid, { sticker: stiker });
      await ctx.react('✅');
    } catch (error) {
      console.error('Error in TakeCommand:', error);
      await ctx.reply('Could not modify sticker');
      await ctx.react('❌');
    }
  }
}
