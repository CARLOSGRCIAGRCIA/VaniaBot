import { Command } from '../../Command.js';
import { CommandCategory, CommandContext } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import type { proto, WAMessage } from '@whiskeysockets/baileys';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { cacheManager } from '@/core/CacheManager.js';
import { logger, logError } from '@/utils/logger.js';

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

  private async withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    const timeout = new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout`)), ms),
    );
    return Promise.race([promise, timeout]).catch(err => {
      logError(`NotifyCommand.${label}`, err);
      throw err;
    }) as Promise<T>;
  }

  private buildContextInfo(_ctx: MessageContext) {
    return {
      externalAdReply: {
        title: '🌸 VaniaBot',
        body: 'Notificación de grupo',
        mediaType: 1,
        renderLargerThumbnail: false,
        showAdAttribution: true,
      },
    };
  }

  async execute(ctx: MessageContext): Promise<void> {
    const extraText = ctx.args.join(' ').trim();
    const footer = '\n\n> _*By VaniaBot*_ 💝';

    const contextInfo = this.buildContextInfo(ctx);

    try {
      const cached = cacheManager.getGroupMetadata(ctx.chat.jid);
      const groupMetadata =
        cached ??
        (await this.withTimeout(ctx.sock.groupMetadata(ctx.chat.jid), 10000, 'groupMetadata'));
      if (!cached) cacheManager.setGroupMetadata(ctx.chat.jid, groupMetadata);
      const participants = groupMetadata.participants.map(p => p.id);

      if (!ctx.quoted) {
        if (!extraText) {
          await ctx.reply(
            `❌ Escribe un mensaje o responde a uno.\n\n` +
              `*Uso:* !n <texto>\n` +
              `*O responde* a cualquier mensaje con !n`,
          );
          return;
        }

        const result = await this.withTimeout(
          ctx.sock.sendMessage(ctx.chat.jid, {
            text: `${extraText}${footer}`,
            mentions: participants,
            contextInfo,
          }),
          15000,
          'sendMessage',
        );
        logger.debug(`[NOTIFY] Mensaje enviado, key: ${result?.key?.id}`);
        return;
      }

      const type = this.getQuotedType(ctx.quoted);

      if (type === 'sticker') {
        await ctx.react('⏳');

        const quotedMsgInfo = this.getQuotedMessageInfo(ctx);
        if (!quotedMsgInfo) {
          await ctx.react('❌');
          await ctx.reply('❌ No se pudo obtener el sticker referenciado.');
          return;
        }

        const buffer = (await this.withTimeout(
          downloadMediaMessage(quotedMsgInfo, 'buffer', {}),
          30000,
          'downloadSticker',
        )) as Buffer;

        await this.withTimeout(
          ctx.sock.sendMessage(ctx.chat.jid, {
            sticker: buffer,
            mentions: participants,
            mimetype: ctx.quoted.stickerMessage?.mimetype || 'image/webp',
          }),
          15000,
          'sendSticker',
        );
        return;
      }

      if (type === 'image') {
        await ctx.react('⏳');

        const quotedMsgInfo = this.getQuotedMessageInfo(ctx);
        if (!quotedMsgInfo) {
          await ctx.react('❌');
          await ctx.reply('❌ No se pudo obtener la imagen referenciada.');
          return;
        }

        const buffer = (await this.withTimeout(
          downloadMediaMessage(quotedMsgInfo, 'buffer', {}),
          30000,
          'downloadImage',
        )) as Buffer;

        const originalCaption = ctx.quoted.imageMessage?.caption || '';
        let caption: string;
        if (extraText && originalCaption) {
          caption = `${extraText}\n\n${originalCaption}${footer}`;
        } else if (extraText) {
          caption = `${extraText}${footer}`;
        } else if (originalCaption) {
          caption = `${originalCaption}${footer}`;
        } else {
          caption = footer.trim();
        }

        await this.withTimeout(
          ctx.sock.sendMessage(ctx.chat.jid, {
            image: buffer,
            caption,
            mentions: participants,
            mimetype: ctx.quoted.imageMessage?.mimetype || 'image/jpeg',
            contextInfo: this.buildContextInfo(ctx),
          }),
          15000,
          'sendImage',
        );
        return;
      }

      if (type === 'video') {
        await ctx.react('⏳');

        const quotedMsgInfo = this.getQuotedMessageInfo(ctx);
        if (!quotedMsgInfo) {
          await ctx.react('❌');
          await ctx.reply('❌ No se pudo obtener el video referenciado.');
          return;
        }

        const buffer = (await this.withTimeout(
          downloadMediaMessage(quotedMsgInfo, 'buffer', {}),
          30000,
          'downloadVideo',
        )) as Buffer;

        const originalCaption = ctx.quoted.videoMessage?.caption || '';
        let caption: string;
        if (extraText && originalCaption) {
          caption = `${extraText}\n\n${originalCaption}${footer}`;
        } else if (extraText) {
          caption = `${extraText}${footer}`;
        } else if (originalCaption) {
          caption = `${originalCaption}${footer}`;
        } else {
          caption = footer.trim();
        }

        await this.withTimeout(
          ctx.sock.sendMessage(ctx.chat.jid, {
            video: buffer,
            caption,
            mentions: participants,
            mimetype: ctx.quoted.videoMessage?.mimetype || 'video/mp4',
            gifPlayback: ctx.quoted.videoMessage?.gifPlayback || false,
            contextInfo: this.buildContextInfo(ctx),
          }),
          15000,
          'sendVideo',
        );
        return;
      }

      if (type === 'audio') {
        if (extraText) {
          await this.withTimeout(
            ctx.sock.sendMessage(ctx.chat.jid, {
              text: `${extraText}${footer}`,
              mentions: participants,
              contextInfo: this.buildContextInfo(ctx),
            }),
            15000,
            'sendAudioText',
          );
        }

        const quotedMsgInfo = this.getQuotedMessageInfo(ctx);
        if (quotedMsgInfo) {
          const buffer = (await this.withTimeout(
            downloadMediaMessage(quotedMsgInfo, 'buffer', {}),
            30000,
            'downloadAudio',
          )) as Buffer;
          await this.withTimeout(
            ctx.sock.sendMessage(ctx.chat.jid, {
              audio: buffer,
              mentions: participants,
              mimetype: ctx.quoted.audioMessage?.mimetype || 'audio/ogg; codecs=opus',
              ptt: ctx.quoted.audioMessage?.ptt || false,
            }),
            15000,
            'sendAudio',
          );
        }
        return;
      }

      if (type === 'document') {
        if (extraText) {
          await this.withTimeout(
            ctx.sock.sendMessage(ctx.chat.jid, {
              text: `${extraText}${footer}`,
              mentions: participants,
              contextInfo: this.buildContextInfo(ctx),
            }),
            15000,
            'sendDocumentText',
          );
        }

        const quotedMsgInfo = this.getQuotedMessageInfo(ctx);
        if (quotedMsgInfo?.message) {
          await this.withTimeout(
            ctx.sock.relayMessage(ctx.chat.jid, quotedMsgInfo.message, {
              messageId: ctx.sock.generateMessageTag(),
            }),
            15000,
            'relayDocument',
          );
        }
        return;
      }

      const quotedText = ctx.quoted.conversation || ctx.quoted.extendedTextMessage?.text || '';

      let notificationText: string;
      if (extraText && quotedText) {
        notificationText = `${extraText}\n\n${quotedText}${footer}`;
      } else if (quotedText) {
        notificationText = `${quotedText}${footer}`;
      } else {
        notificationText = `${extraText}${footer}`;
      }

      await this.withTimeout(
        ctx.sock.sendMessage(ctx.chat.jid, {
          text: notificationText,
          mentions: participants,
          contextInfo: this.buildContextInfo(ctx),
        }),
        15000,
        'sendText',
      );
    } catch (error) {
      logError('NotifyCommand.execute', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al enviar la notificación.');
    }
  }
}
