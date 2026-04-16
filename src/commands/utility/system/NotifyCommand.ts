/**
 * @fileoverview NotifyCommand.ts - Group notification command
 *
 * Sends notifications to all group members by mentioning them.
 * Supports text messages, images, videos, stickers, audio, and documents.
 * Can quote/reply to messages and add extra text.
 *
 * @author **Carlos G** ⭐
 * @github CARLOSGRCIAGRCIA
 * @created 2026-04-03
 * @module commands/utility/system/NotifyCommand
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import type { proto, WAMessage } from '@whiskeysockets/baileys';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { cacheManager } from '@/core/CacheManager.js';
import { primeService } from '@/services/system/PrimeService.js';

/** Timeout for downloading media (10 seconds) */
const DOWNLOAD_TIMEOUT = 10000;

/**
 * NotifyCommand - Broadcasts messages to all group members.
 *
 * This command sends notifications by mentioning all group participants.
 * It can handle various message types including text, images, videos,
 * stickers, audio, and documents. When replying to a message, it
 * includes the quoted content in the notification.
 *
 * @class NotifyCommand
 * @extends Command
 *
 * @example
 * // Send a text notification
 * !n Important meeting at 3 PM
 *
 * // Reply to a message to include it
 * !n Check this out (replying to an image)
 *
 * @example
 * // Send with alias
 * !notify Important announcement
 *
 * @example
 * // Reply to a message with additional text
 * !n Please review this document (replying to a PDF)
 */
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

  /**
   * Determines the type of a quoted message.
   *
   * @method getQuotedType
   * @param {proto.IMessage} quoted - The quoted message object
   * @returns {string} Message type: 'text', 'image', 'video', 'sticker', 'audio', 'document', 'none', 'unknown'
   * @private
   */
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

  /**
   * Extracts quoted message info from a message context.
   *
   * @method getQuotedMessageInfo
   * @param {MessageContext} ctx - The message context
   * @returns {WAMessage | null} The quoted message as WAMessage or null if not found
   * @private
   */
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

  /**
   * Downloads media from a message with timeout protection.
   *
   * @method downloadWithTimeout
   * @param {WAMessage} msg - The message containing media to download
   * @returns {Promise<Buffer | null>} Media buffer or null if download fails/times out
   * @private
   */
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

  /**
   * Gets all participant JIDs for a group.
   * Uses cache when available to reduce API calls.
   *
   * @method getParticipants
   * @param {MessageContext} ctx - The message context
   * @returns {Promise<string[]>} Array of participant JIDs
   * @private
   */
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

  /**
   * Builds a caption from extra text, original caption, and footer.
   *
   * @method buildCaption
   * @param {string} extraText - Additional text from command arguments
   * @param {string} originalCaption - Original media caption
   * @param {string} footer - Footer text (usually prime branding)
   * @returns {string} Combined caption string
   * @private
   */
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

  /**
   * Executes the notify command.
   *
   * Sends a notification to all group members by:
   * 1. Getting all participant JIDs
   * 2. Handling different message types (text, image, video, sticker, audio, document)
   * 3. Including quoted message content when replying
   * 4. Adding the prime footer
   *
   * @method execute
   * @param {MessageContext} ctx - The message context
   * @returns {Promise<void>}
   *
   * @example
   * // Text notification
   * !n Important announcement
   *
   * @example
   * // Reply to media
   * !n Check this out (replying to an image)
   *
   * @example
   * // Reply to text message
   * !n Please read this (replying to a text)
   */
  async execute(ctx: MessageContext): Promise<void> {
    const extraText = ctx.args.join(' ').trim();
    const footer =
      '\n\n' + (await primeService.formatFooter(ctx.sock, ctx.chat.jid, ctx.chat.isGroup));

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
        const originalMessage = quotedMsgInfo?.message;

        if (!originalMessage) {
          await ctx.react('❌');
          await ctx.reply('❌ No se pudo obtener el mensaje referenciado.');
          return;
        }

        const newMessage = JSON.parse(JSON.stringify(originalMessage));

        if (newMessage.conversation) {
          newMessage.conversation = `${newMessage.conversation}${footer}`;
        } else if (newMessage.extendedTextMessage) {
          newMessage.extendedTextMessage.text = `${newMessage.extendedTextMessage.text}${footer}`;
        }

        if (participants.length > 0) {
          if (!newMessage.extendedTextMessage) {
            newMessage.extendedTextMessage = {};
          }
          newMessage.extendedTextMessage.contextInfo = {
            ...newMessage.extendedTextMessage.contextInfo,
            mentionedJid: participants,
          };
        }

        await ctx.sock.relayMessage(ctx.chat.jid, newMessage, {
          messageId: ctx.sock.generateMessageTag(),
        });
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
