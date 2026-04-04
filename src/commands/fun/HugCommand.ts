import { Command } from '../Command.js';
import { CommandCategory, CommandContext } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';

const HUG_VIDEOS = [
  'https://telegra.ph/file/6a3aa01fabb95e3558eec.mp4',
  'https://telegra.ph/file/0e5b24907be34da0cbe84.mp4',
  'https://telegra.ph/file/6bc3cd10684f036e541ed.mp4',
  'https://telegra.ph/file/3e443a3363a90906220d8.mp4',
  'https://telegra.ph/file/56d886660696365f9696b.mp4',
  'https://telegra.ph/file/3eeadd9d69653803b33c6.mp4',
  'https://telegra.ph/file/436624e53c5f041bfd597.mp4',
  'https://telegra.ph/file/5866f0929bf0c8fe6a909.mp4',
];

export class HugCommand extends Command {
  name = 'hug';
  description = 'Abrazar a alguien';
  category = CommandCategory.FUN;
  aliases = ['abrazar'];
  usage = '!hug [@usuario]';
  examples = ['!hug', '!hug @usuario'];
  cooldown = 10_000;
  contexts = [CommandContext.GROUP];

  async execute(ctx: MessageContext): Promise<void> {
    const mentionedJid = ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedSender = ctx.message.message?.extendedTextMessage?.contextInfo?.quotedMessage
      ? ctx.message.message.extendedTextMessage.contextInfo.participant
      : null;

    const targetJid = mentionedJid || quotedSender || ctx.sender.jid;
    const senderName = ctx.sender.pushName || ctx.sender.jid.split('@')[0];

    await ctx.react('🫂');

    let message: string;
    if (targetJid === ctx.sender.jid) {
      message = `${senderName} se abrazó a sí mismo`;
    } else {
      message = `${senderName} le dio un fuerte abrazo a @${targetJid.split('@')[0]}`;
    }

    const video = HUG_VIDEOS[Math.floor(Math.random() * HUG_VIDEOS.length)];

    await ctx.sock.sendMessage(ctx.chat.jid, {
      video: { url: video },
      gifPlayback: true,
      caption: message,
      mentions: targetJid !== ctx.sender.jid ? [targetJid] : undefined,
    });
  }
}
