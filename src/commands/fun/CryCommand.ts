import { Command } from '../Command.js';
import { CommandCategory, CommandContext } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';

const CRY_VIDEOS = [
  'https://qu.ax/gRjHK.mp4',
  'https://qu.ax/VjjCJ.mp4',
  'https://qu.ax/ltieQ.mp4',
  'https://qu.ax/oryVi.mp4',
  'https://qu.ax/YprzU.mp4',
  'https://qu.ax/nxaUW.mp4',
  'https://qu.ax/woSGV.mp4',
  'https://qu.ax/WkmA.mp4',
];

export class CryCommand extends Command {
  name = 'cry';
  description = 'Llorar';
  category = CommandCategory.FUN;
  aliases = ['llorar'];
  usage = '!cry [@usuario]';
  examples = ['!cry', '!cry @usuario'];
  cooldown = 10_000;
  contexts = [CommandContext.GROUP];

  async execute(ctx: MessageContext): Promise<void> {
    const mentionedJid = ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedSender = ctx.message.message?.extendedTextMessage?.contextInfo?.quotedMessage
      ? ctx.message.message.extendedTextMessage.contextInfo.participant
      : null;

    const targetJid = mentionedJid || quotedSender || ctx.sender.jid;
    const senderName = ctx.sender.pushName || ctx.sender.jid.split('@')[0];

    await ctx.react('😭');

    let message: string;
    if (targetJid === ctx.sender.jid) {
      message = `${senderName} está llorando`;
    } else {
      message = `${senderName} está llorando por @${targetJid.split('@')[0]}`;
    }

    const video = CRY_VIDEOS[Math.floor(Math.random() * CRY_VIDEOS.length)];

    await ctx.sock.sendMessage(ctx.chat.jid, {
      video: { url: video },
      gifPlayback: true,
      caption: message,
      mentions: targetJid !== ctx.sender.jid ? [targetJid] : undefined,
    });
  }
}
