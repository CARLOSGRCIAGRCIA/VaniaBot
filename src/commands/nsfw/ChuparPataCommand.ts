import { Command } from '../Command.js';
import { CommandCategory, CommandContext } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

const PATA_VIDEOS = [
  'https://files.catbox.moe/zuwr3w.mp4',
  'https://files.catbox.moe/vkllyl.mp4',
  'https://files.catbox.moe/es3aji.mp4',
];

export class ChuparPataCommand extends Command {
  name = 'chuparpata';
  description = 'Interacción +18';
  category = CommandCategory.FUN;
  aliases = ['chuparpata', 'chupaepatas'];
  usage = '!chuparpata [@usuario]';
  examples = ['!chuparpata @usuario'];
  cooldown = 10_000;
  contexts = [CommandContext.GROUP];

  async execute(ctx: MessageContext): Promise<void> {
    try {
      const group = await serviceManager.groupService.getGroup(ctx.chat.jid);
      if (!group.nsfw) {
        await ctx.reply(
          `˚₊· ͟͟͞͞➳ *nsfw desactivado* ˚₊· ͟͟͞͞➳\n\n` +
            `❌ Los comandos +18 están desactivados en este grupo.`,
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

    await ctx.react('👣');

    let message: string;
    if (targetJid === ctx.sender.jid) {
      message = `${senderName} está chupando patas por ahí`;
    } else {
      message = `${senderName} está chupando la pata de @${targetJid.split('@')[0]}`;
    }

    const video = PATA_VIDEOS[Math.floor(Math.random() * PATA_VIDEOS.length)];

    await ctx.sock.sendMessage(ctx.chat.jid, {
      video: { url: video },
      gifPlayback: true,
      caption: message,
      mentions: targetJid !== ctx.sender.jid ? [targetJid] : undefined,
    });
  }
}
