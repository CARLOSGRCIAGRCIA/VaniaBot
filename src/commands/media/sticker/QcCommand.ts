import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { StickerService } from '@/services/media/StickerService.js';
import type { Sharp } from 'sharp';
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
      await ctx.reply(' Missing text!\n\nUsage: !qc <text>');
      return;
    }

    if (!text) {
      await ctx.reply(' Missing text!');
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
      await ctx.reply(' Text cannot exceed 40 characters');
      return;
    }

    await ctx.react('⏳');

    try {
      let sharpFn: (input: Buffer) => Sharp;
      try {
        sharpFn = (await import('sharp')).default as (input: Buffer) => Sharp;
      } catch {
        await ctx.reply(
          `˚₊· ͟͟͞͞➳ *oops, esta función está dormidita* ˚₊· ͟͟͞͞➳\n\n` +
            `✿ todavía no tengo todo lo que necesito\n` +
            `✩ prometo que pronto estará lista, espérame ✩`,
        );
        await ctx.react('❌');
        return;
      }

      let pp = 'https://telegra.ph/file/24fa902ead26340f3df2c.png';
      try {
        const profilePic = await ctx.sock.profilePictureUrl(targetJid, 'image');
        if (profilePic) pp = profilePic;
      } catch (error) {
        console.warn('Could not fetch profile picture:', error);
      }

      let nombre = ctx.sender.pushName || 'User';

      if (mentionedJid) {
        try {
          const mentionedContact =
            ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
          if (mentionedContact && mentionedContact.length > 0) {
            nombre = ctx.sender.pushName || nombre;
          }
        } catch (error) {
          console.warn('Could not fetch mentioned user info:', error);
        }
      }

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
      });

      const buffer = Buffer.from(res.data.result.image, 'base64');

      const resizedBuffer = await sharpFn(buffer)
        .resize(512, 512, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 100 })
        .toBuffer();

      const stiker = await this.stickerService.createSticker(resizedBuffer, {
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
}
