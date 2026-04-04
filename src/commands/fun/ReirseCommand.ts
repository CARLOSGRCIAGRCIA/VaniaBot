import { Command } from '../Command.js';
import { CommandCategory, CommandContext } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';

const LAUGH_VIDEOS = [
  'https://telegra.ph/file/5fa4fd7f4306aa7b2e17a.mp4',
  'https://telegra.ph/file/b299115a77fadb7594ca0.mp4',
  'https://telegra.ph/file/9938a8c2e54317d6b8250.mp4',
  'https://telegra.ph/file/e6c7b3f7d482ae42db9a7.mp4',
  'https://telegra.ph/file/a61b52737df7459580129.mp4',
  'https://telegra.ph/file/f34e1d5c8f17bd2739a51.mp4',
  'https://telegra.ph/file/c345ed1ca18a53655f857.mp4',
  'https://telegra.ph/file/4eec929f54bc4d83293a3.mp4',
  'https://telegra.ph/file/856e38b2303046990531c.mp4',
];

export class ReirseCommand extends Command {
  name = 'reirse';
  description = 'Reírse';
  category = CommandCategory.FUN;
  aliases = ['laugh'];
  usage = '!reirse [@usuario]';
  examples = ['!reirse', '!reirse @usuario'];
  cooldown = 10_000;
  contexts = [CommandContext.GROUP];

  async execute(ctx: MessageContext): Promise<void> {
    const mentionedJid = ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedSender = ctx.message.message?.extendedTextMessage?.contextInfo?.quotedMessage
      ? ctx.message.message.extendedTextMessage.contextInfo.participant
      : null;

    const targetJid = mentionedJid || quotedSender || ctx.sender.jid;
    const senderName = ctx.sender.pushName || ctx.sender.jid.split('@')[0];

    await ctx.react('😹');

    let message: string;
    if (targetJid === ctx.sender.jid) {
      message = `${senderName} se está riendo`;
    } else {
      message = `${senderName} se está riendo de @${targetJid.split('@')[0]}`;
    }

    const video = LAUGH_VIDEOS[Math.floor(Math.random() * LAUGH_VIDEOS.length)];

    await ctx.sock.sendMessage(ctx.chat.jid, {
      video: { url: video },
      gifPlayback: true,
      caption: message,
      mentions: targetJid !== ctx.sender.jid ? [targetJid] : undefined,
    });
  }
}
