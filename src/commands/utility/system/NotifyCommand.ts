import { Command } from '../../Command.js';
import { CommandCategory, CommandContext } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import type { proto, WAMessage } from '@whiskeysockets/baileys';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { cacheManager } from '@/core/CacheManager.js';

const DOWNLOAD_TIMEOUT = 10000;

export class NotifyCommand extends Command {
  name = 'notify';
  description = 'Notifica a todos mencionando un mensaje referenciado o texto.';
  category = CommandCategory.UTILITY;
  aliases = ['n'];
  usage = '!n [texto] | responde a un mensaje con !n [texto adicional]';
  examples = [
    '!n Reunión importante a las 3 PM',
    '!n (respondiendo un texto)',
    '!n Miren esto jajaja (respondiendo sticker/imagen/video)',
  ];
  contexts = [CommandContext.GROUP];
  cooldown = 5000;

  private getQuotedType(quoted: proto.IMessage): string {
    if (!quoted) return 'none';
    if (quoted.conversation || quoted.extendedTextMessage) return 'text';
    if (quoted.imageMessage) return 'image';
    if (quoted.videoMessage) return 'video';
    if (quoted.stickerMessage) return 'sticker';
    if (quoted.audioMessage) return 'audio';
    if (quoted.documentMessage) return 'document';
    return 'unknown';
  }

  private getQuotedMessageInfo(ctx: MessageContext): WAMessage | null {
    try {
      const contextInfo =
        ctx.message.message?.extendedTextMessage?.contextInfo ||
        ctx.message.message?.imageMessage?.contextInfo ||
        ctx.message.message?.videoMessage?.contextInfo ||
        ctx.message.message?.stickerMessage?.contextInfo ||
        ctx.message.message?.audioMessage?.contextInfo ||
        ctx.message.message?.documentMessage?.contextInfo;

      if (!contextInfo?.quotedMessage || !contextInfo.stanzaId) return null;

      return {
        key: {
          remoteJid: ctx.chat.jid,
          fromMe: contextInfo.participant === ctx.sock.user?.id,
          id: contextInfo.stanzaId,
          participant: contextInfo.participant,
        },
        message: contextInfo.quotedMessage,
      } as WAMessage;
    } catch {
      return null;
    }
  }

  private async downloadWithTimeout(msg: WAMessage): Promise<Buffer | null> {
    try {
      const buffer = await Promise.race([
        downloadMediaMessage(msg, 'buffer', {}) as Promise<Buffer>,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Download timeout')), DOWNLOAD_TIMEOUT),
        ),
      ]);
      return buffer as Buffer;
    } catch {
      return null;
    }
  }

  private async getParticipants(ctx: MessageContext): Promise<string[]> {
    const cachedParticipants = cacheManager.getGroupParticipants(ctx.chat.jid);
    if (cachedParticipants) return cachedParticipants;

    const cachedMetadata = cacheManager.getGroupMetadata(ctx.chat.jid);
    const groupMetadata = cachedMetadata ?? (await ctx.sock.groupMetadata(ctx.chat.jid));

    const participants = groupMetadata.participants.map(p => p.id);

    if (!cachedMetadata) {
      cacheManager.setGroupMetadata(ctx.chat.jid, groupMetadata);
    }
    cacheManager.setGroupParticipants(ctx.chat.jid, participants);

    return participants;
  }

  private buildCaption(extraText: string, originalCaption: string, footer: string): string {
    if (extraText && originalCaption) {
      return `${extraText}\n\n${originalCaption}${footer}`;
    } else if (extraText) {
      return `${extraText}${footer}`;
    } else if (originalCaption) {
      return `${originalCaption}${footer}`;
    }
    return footer.trim();
  }

  async execute(ctx: MessageContext): Promise<void> {
    const extraText = ctx.args.join(' ').trim();
    const footer = '\n\n> _*By VaniaBot*_ 💝';

    try {
      const participants = await this.getParticipants(ctx);

      if (!ctx.quoted) {
        if (!extraText) {
          await ctx.reply(
            `˚₊· ͟͟͞͞➳ *oops, escríbeme algo* ˚₊· ͟͟͞͞➳\n\n` +
              `✿ *!n* <texto>\n` +
              `✩ o responde a un mensaje con *!n* ✩`,
          );
          return;
        }

        await ctx.sock.sendMessage(
          ctx.chat.jid,
          { text: `${extraText}${footer}`, mentions: participants },
          { quoted: ctx.message },
        );
        return;
      }

      const type = this.getQuotedType(ctx.quoted);
      const quotedMsgInfo = this.getQuotedMessageInfo(ctx);

      if (type === 'text') {
        const quotedText = ctx.quoted.conversation || ctx.quoted.extendedTextMessage?.text || '';

        let notificationText: string;
        if (extraText && quotedText) {
          notificationText = `${extraText}\n\n${quotedText}${footer}`;
        } else if (quotedText) {
          notificationText = `${quotedText}${footer}`;
        } else {
          notificationText = `${extraText}${footer}`;
        }

        await ctx.sock.sendMessage(
          ctx.chat.jid,
          { text: notificationText, mentions: participants },
          { quoted: ctx.message },
        );
        return;
      }

      await ctx.react('📢');

      if (!quotedMsgInfo) {
        await ctx.react('❌');
        await ctx.reply('❌ No se pudo obtener el mensaje referenciado.');
        return;
      }

      if (type === 'sticker') {
        const buffer = await this.downloadWithTimeout(quotedMsgInfo);
        if (!buffer) {
          await ctx.react('❌');
          await ctx.reply('❌ Timeout al descargar el sticker.');
          return;
        }

        await ctx.sock.sendMessage(ctx.chat.jid, {
          sticker: buffer,
          mentions: participants,
          mimetype: ctx.quoted.stickerMessage?.mimetype || 'image/webp',
        });
        return;
      }

      if (type === 'image') {
        const buffer = await this.downloadWithTimeout(quotedMsgInfo);
        if (!buffer) {
          await ctx.react('❌');
          await ctx.reply('❌ Timeout al descargar la imagen.');
          return;
        }

        const originalCaption = ctx.quoted.imageMessage?.caption || '';
        const caption = this.buildCaption(extraText, originalCaption, footer);

        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: buffer,
          caption,
          mentions: participants,
          mimetype: ctx.quoted.imageMessage?.mimetype || 'image/jpeg',
        });
        return;
      }

      if (type === 'video') {
        const buffer = await this.downloadWithTimeout(quotedMsgInfo);
        if (!buffer) {
          await ctx.react('❌');
          await ctx.reply('❌ Timeout al descargar el video.');
          return;
        }

        const originalCaption = ctx.quoted.videoMessage?.caption || '';
        const caption = this.buildCaption(extraText, originalCaption, footer);

        await ctx.sock.sendMessage(ctx.chat.jid, {
          video: buffer,
          caption,
          mentions: participants,
          mimetype: ctx.quoted.videoMessage?.mimetype || 'video/mp4',
          gifPlayback: ctx.quoted.videoMessage?.gifPlayback || false,
        });
        return;
      }

      if (type === 'audio') {
        if (extraText) {
          await ctx.sock.sendMessage(ctx.chat.jid, {
            text: `${extraText}${footer}`,
            mentions: participants,
          });
        }

        const buffer = await this.downloadWithTimeout(quotedMsgInfo);
        if (buffer) {
          await ctx.sock.sendMessage(ctx.chat.jid, {
            audio: buffer,
            mentions: participants,
            mimetype: ctx.quoted.audioMessage?.mimetype || 'audio/ogg; codecs=opus',
            ptt: ctx.quoted.audioMessage?.ptt || false,
          });
        }
        return;
      }

      if (type === 'document') {
        if (extraText) {
          await ctx.sock.sendMessage(ctx.chat.jid, {
            text: `${extraText}${footer}`,
            mentions: participants,
          });
        }

        if (quotedMsgInfo?.message) {
          await ctx.sock.relayMessage(ctx.chat.jid, quotedMsgInfo.message, {
            messageId: ctx.sock.generateMessageTag(),
          });
        }
        return;
      }
    } catch (error) {
      console.error('Error in NotifyCommand:', error);
      await ctx.react('❌').catch(() => {});
      await ctx.reply('❌ Error al enviar la notificación.').catch(() => {});
    }
  }
}
