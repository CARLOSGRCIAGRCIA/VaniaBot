import { Command } from '../Command.js';
import { CommandCategory, CommandContext } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

const FOLLAR_VIDEOS = [
  'https://files.catbox.moe/7ito13.mp4',
  'https://files.catbox.moe/6to3zj.mp4',
  'https://files.catbox.moe/8j94sh.mp4',
  'https://files.catbox.moe/ylfpb7.mp4',
  'https://files.catbox.moe/kccjc7.mp4',
  'https://files.catbox.moe/lt9e1u.mp4',
];

export class FollarCommand extends Command {
  name = 'follar';
  description = 'Interacción +18';
  category = CommandCategory.FUN;
  aliases = ['follar'];
  usage = '!follar [@usuario]';
  examples = ['!follar @usuario'];
  cooldown = 10_000;
  contexts = [CommandContext.GROUP];

  async execute(ctx: MessageContext): Promise<void> {
    try {
      const group = await serviceManager.groupService.getGroup(ctx.chat.jid);
      if (!group.nsfw) {
        await ctx.reply(
          `˚₊· ͟͟͞͞➳ *nsfw desactivado* ˚₊· ͟͟͞͞➳\n\n` +
            `❌ Los comandos +18 están desactivados en este grupo.\n` +
            `Pide a un admin que active los comandos NSFW.`,
        );
        return;
      }
    } catch {
      await ctx.reply(`❌ No pude verificar el estado de NSFW.`);
      return;
    }

    const mentionedJid = ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedSender = ctx.message.message?.extendedTextMessage?.contextInfo?.quotedMessage
      ? ctx.message.message.extendedTextMessage.contextInfo.participant
      : null;

    const targetJid = mentionedJid || quotedSender || ctx.sender.jid;
    const senderName = ctx.sender.pushName || ctx.sender.jid.split('@')[0];

    await ctx.react('🥵');

    let message: string;
    if (targetJid === ctx.sender.jid) {
      message = `${senderName} está follando ricamente`;
    } else {
      message = `${senderName} folló durísimo a @${targetJid.split('@')[0]}`;
    }

    const video = FOLLAR_VIDEOS[Math.floor(Math.random() * FOLLAR_VIDEOS.length)];

    await ctx.sock.sendMessage(ctx.chat.jid, {
      video: { url: video },
      gifPlayback: true,
      caption: message,
      mentions: targetJid !== ctx.sender.jid ? [targetJid] : undefined,
    });
  }
}
