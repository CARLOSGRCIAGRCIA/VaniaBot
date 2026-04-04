import { Command } from '../Command.js';
import { CommandCategory, CommandContext } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

const BOOBS_VIDEOS = [
  'https://telegra.ph/file/e6bf14b93dfe22c4972d0.mp4',
  'https://telegra.ph/file/075db3ebba7126d2f0d95.mp4',
  'https://telegra.ph/file/37c21753892b5d843b9ce.mp4',
  'https://telegra.ph/file/04bbf490e29158f03e348.mp4',
  'https://telegra.ph/file/82d32821f3b57b62359f2.mp4',
  'https://telegra.ph/file/36149496affe5d02c8965.mp4',
  'https://telegra.ph/file/61d85d10baf2e3b9a4cde.mp4',
  'https://telegra.ph/file/538c95e4f1c481bcc3cce.mp4',
  'https://telegra.ph/file/e999ef6e67a1a75a515d6.mp4',
];

export class GrabBoobsCommand extends Command {
  name = 'grabboobs';
  description = 'Interacción +18';
  category = CommandCategory.FUN;
  aliases = ['agarrartetas', 'grabboobs'];
  usage = '!grabboobs [@usuario]';
  examples = ['!grabboobs @usuario'];
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

    await ctx.react('🔥');

    let message: string;
    if (targetJid === ctx.sender.jid) {
      message = `${senderName} está agarrando unas tetas`;
    } else {
      message = `${senderName} le está agarrando las tetas a @${targetJid.split('@')[0]}`;
    }

    const video = BOOBS_VIDEOS[Math.floor(Math.random() * BOOBS_VIDEOS.length)];

    await ctx.sock.sendMessage(ctx.chat.jid, {
      video: { url: video },
      gifPlayback: true,
      caption: message,
      mentions: targetJid !== ctx.sender.jid ? [targetJid] : undefined,
    });
  }
}
