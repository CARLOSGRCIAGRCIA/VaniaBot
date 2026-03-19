import { Command } from '../../Command.js';
import { CommandCategory, CommandContext } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import type { proto, WAMessage } from '@whiskeysockets/baileys';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { cacheManager } from '@/core/CacheManager.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

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

  private getLogoBuffer(): Buffer | undefined {
    try {
      const logoPath = join(process.cwd(), 'data/assets/logo.png');
      if (existsSync(logoPath)) return readFileSync(logoPath);
    } catch {
      // Si falla la lectura, continúa sin imagen
    }
    return undefined;
  }

  private buildContextInfo(ctx: MessageContext) {
    const thumbnail = this.getLogoBuffer();
    const botName = ctx.sender.pushName || 'VaniaBot';

    return {
      externalAdReply: {
        title: '🌸 VaniaBot',
        body: 'Notificación de grupo',
        thumbnail,
        thumbnailUrl: 'https://i.imgur.com/placeholder.png',
        mediaType: 1,
        renderLargerThumbnail: false,
        showAdAttribution: true,
      },
      quotedMessage: { conversation: botName },
      participant: ctx.sock.user?.id || '0@s.whatsapp.net',
    };
  }

  async execute(ctx: MessageContext): Promise<void> {
    const extraText = ctx.args.join(' ').trim();
    const footer = '\n\n> _*By VaniaBot*_ 💝';

    console.log('[NOTIFY] === INICIO ===');
    console.log('[NOTIFY] extraText:', extraText);
    console.log('[NOTIFY] ctx.chat.jid:', ctx.chat.jid);
    console.log('[NOTIFY] ctx.quoted:', ctx.quoted ? 'si' : 'no');
    console.log('[NOTIFY] ctx.sender.pushName:', ctx.sender.pushName);
    console.log('[NOTIFY] Bot user id:', ctx.sock.user?.id);

    const contextInfo = this.buildContextInfo(ctx);
    console.log('[NOTIFY] contextInfo keys:', Object.keys(contextInfo));
    console.log(
      '[NOTIFY] contextInfo.externalAdReply:',
      JSON.stringify(contextInfo.externalAdReply, null, 2),
    );

    try {
      const cached = cacheManager.getGroupMetadata(ctx.chat.jid);
      const groupMetadata = cached ?? (await ctx.sock.groupMetadata(ctx.chat.jid));
      if (!cached) cacheManager.setGroupMetadata(ctx.chat.jid, groupMetadata);
      const participants = groupMetadata.participants.map(p => p.id);
      console.log('[NOTIFY] participants count:', participants.length);

      if (!ctx.quoted) {
        if (!extraText) {
          await ctx.reply(
            `❌ Escribe un mensaje o responde a uno.\n\n` +
              `*Uso:* !n <texto>\n` +
              `*O responde* a cualquier mensaje con !n`,
          );
          return;
        }

        console.log('[NOTIFY] Enviando mensaje de texto...');
        console.log('[NOTIFY] sendMessage args:', {
          jid: ctx.chat.jid,
          text: `${extraText}${footer}`.substring(0, 100),
          mentionsCount: participants.length,
          hasContextInfo: !!contextInfo,
        });

        try {
          const result = await ctx.sock.sendMessage(ctx.chat.jid, {
            text: `${extraText}${footer}`,
            mentions: participants,
            contextInfo,
          });
          console.log('[NOTIFY] Mensaje enviado exitosamente:', JSON.stringify(result));
        } catch (sendError) {
          console.error('[NOTIFY] Error en sendMessage:', sendError);
          console.error('[NOTIFY] Error details:', JSON.stringify(sendError, null, 2));
          throw sendError;
        }
        return;
      }

      const type = this.getQuotedType(ctx.quoted);
      console.log('[NOTIFY] quoted type:', type);

      if (type === 'sticker') {
        await ctx.react('⏳');

        const quotedMsgInfo = this.getQuotedMessageInfo(ctx);
        if (!quotedMsgInfo) {
          await ctx.react('❌');
          await ctx.reply('❌ No se pudo obtener el sticker referenciado.');
          return;
        }

        const buffer = (await downloadMediaMessage(quotedMsgInfo, 'buffer', {})) as Buffer;

        await ctx.sock.sendMessage(ctx.chat.jid, {
          sticker: buffer,
          mentions: participants,
          mimetype: ctx.quoted.stickerMessage?.mimetype || 'image/webp',
        });
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

        const buffer = (await downloadMediaMessage(quotedMsgInfo, 'buffer', {})) as Buffer;

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

        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: buffer,
          caption,
          mentions: participants,
          mimetype: ctx.quoted.imageMessage?.mimetype || 'image/jpeg',
          contextInfo: this.buildContextInfo(ctx),
        });
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

        const buffer = (await downloadMediaMessage(quotedMsgInfo, 'buffer', {})) as Buffer;

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

        await ctx.sock.sendMessage(ctx.chat.jid, {
          video: buffer,
          caption,
          mentions: participants,
          mimetype: ctx.quoted.videoMessage?.mimetype || 'video/mp4',
          gifPlayback: ctx.quoted.videoMessage?.gifPlayback || false,
          contextInfo: this.buildContextInfo(ctx),
        });
        return;
      }

      if (type === 'audio') {
        if (extraText) {
          await ctx.sock.sendMessage(ctx.chat.jid, {
            text: `${extraText}${footer}`,
            mentions: participants,
            contextInfo: this.buildContextInfo(ctx),
          });
        }

        const quotedMsgInfo = this.getQuotedMessageInfo(ctx);
        if (quotedMsgInfo) {
          const buffer = (await downloadMediaMessage(quotedMsgInfo, 'buffer', {})) as Buffer;
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
            contextInfo: this.buildContextInfo(ctx),
          });
        }

        const quotedMsgInfo = this.getQuotedMessageInfo(ctx);
        if (quotedMsgInfo?.message) {
          await ctx.sock.relayMessage(ctx.chat.jid, quotedMsgInfo.message, {
            messageId: ctx.sock.generateMessageTag(),
          });
        }
        return;
      }

      // Tipo: text
      const quotedText = ctx.quoted.conversation || ctx.quoted.extendedTextMessage?.text || '';

      let notificationText: string;
      if (extraText && quotedText) {
        notificationText = `${extraText}\n\n${quotedText}${footer}`;
      } else if (quotedText) {
        notificationText = `${quotedText}${footer}`;
      } else {
        notificationText = `${extraText}${footer}`;
      }

      await ctx.sock.sendMessage(ctx.chat.jid, {
        text: notificationText,
        mentions: participants,
        contextInfo: this.buildContextInfo(ctx),
      });
    } catch (error) {
      console.error('[NOTIFY] === ERROR ===');
      console.error('[NOTIFY] Error completo:', error);
      console.error('[NOTIFY] Error message:', (error as Error)?.message);
      console.error('[NOTIFY] Error stack:', (error as Error)?.stack);
      await ctx.react('❌');
      await ctx.reply('❌ Error al enviar la notificación.');
    }
    console.log('[NOTIFY] === FIN ===');
  }
}
