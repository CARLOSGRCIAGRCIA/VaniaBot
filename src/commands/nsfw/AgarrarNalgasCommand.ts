import { Command } from '../Command.js';
import { CommandCategory, CommandContext } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

const NALGAS_VIDEOS = [
  'https://files.catbox.moe/yjulgu.mp4',
  'https://files.catbox.moe/erm82k.mp4',
  'https://files.catbox.moe/9m1nkp.mp4',
  'https://files.catbox.moe/rzijb5.mp4',
];

export class AgarrarNalgasCommand extends Command {
  name = 'agarrarnalgas';
  description = 'Interacción +18';
  category = CommandCategory.FUN;
  aliases = ['agarrarnalgas'];
  usage = '!agarrarnalgas [@usuario]';
  examples = ['!agarrarnalgas @usuario'];
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

    await ctx.react('🍑');

    let message: string;
    if (targetJid === ctx.sender.jid) {
      message = `${senderName} está agarrando nalgas por ahí`;
    } else {
      message = `${senderName} está agarrando las nalgas de @${targetJid.split('@')[0]}`;
    }

    const video = NALGAS_VIDEOS[Math.floor(Math.random() * NALGAS_VIDEOS.length)];

    await ctx.sock.sendMessage(ctx.chat.jid, {
      video: { url: video },
      gifPlayback: true,
      caption: message,
      mentions: targetJid !== ctx.sender.jid ? [targetJid] : undefined,
    });
  }
}
