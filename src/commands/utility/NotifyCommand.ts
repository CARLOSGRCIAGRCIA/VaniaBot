import { Command } from "../Command.js";
import { CommandCategory, CommandContext } from "@/types/index.js";
import type { MessageContext } from "@/types/index.js";
import type { proto } from "@whiskeysockets/baileys";
import { downloadMediaMessage } from "@whiskeysockets/baileys";

export class NotifyCommand extends Command {
  name = "notify";
  description = "Notifica a todos mencionando un mensaje referenciado o texto.";
  category = CommandCategory.UTILITY;
  aliases = ["n"];
  usage = "!n [texto] | responde a un mensaje con !n [texto adicional]";
  examples = [
    "!n Reunión importante a las 3 PM",
    "!n (respondiendo un texto)",
    "!n Miren esto jajaja (respondiendo sticker/imagen/video)",
  ];
  contexts = [CommandContext.GROUP];
  cooldown = 5000;

  private getQuotedType(quoted: proto.IMessage): string {
    if (!quoted) return "none";
    if (quoted.conversation || quoted.extendedTextMessage) return "text";
    if (quoted.imageMessage) return "image";
    if (quoted.videoMessage) return "video";
    if (quoted.stickerMessage) return "sticker";
    if (quoted.audioMessage) return "audio";
    if (quoted.documentMessage) return "document";
    return "unknown";
  }

  private getQuotedMessageInfo(
    ctx: MessageContext,
  ): proto.IWebMessageInfo | null {
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
      } as proto.IWebMessageInfo;
    } catch {
      return null;
    }
  }

  async execute(ctx: MessageContext): Promise<void> {
    const extraText = ctx.args.join(" ").trim();
    const footer = "\n\n> _*By VaniaBot*_ 💝";

    try {
      const groupMetadata = await ctx.sock.groupMetadata(ctx.chat.jid);
      const participants = groupMetadata.participants.map((p) => p.id);

      if (!ctx.quoted) {
        if (!extraText) {
          await ctx.reply(
            `❌ Escribe un mensaje o responde a uno.\n\n` +
              `*Uso:* !n <texto>\n` +
              `*O responde* a cualquier mensaje con !n`,
          );
          return;
        }

        await ctx.sock.sendMessage(
          ctx.chat.jid,
          { text: `${extraText}${footer}`, mentions: participants },
          { quoted: ctx.message },
        );
        await ctx.react("✅");
        return;
      }

      const type = this.getQuotedType(ctx.quoted);

      if (type === "sticker") {
        await ctx.react("⏳");

        const quotedMsgInfo = this.getQuotedMessageInfo(ctx);
        if (!quotedMsgInfo) {
          await ctx.react("❌");
          await ctx.reply("❌ No se pudo obtener el sticker referenciado.");
          return;
        }

        const buffer = (await downloadMediaMessage(
          quotedMsgInfo,
          "buffer",
          {},
        )) as Buffer;

        await ctx.sock.sendMessage(ctx.chat.jid, {
          sticker: buffer,
          mentions: participants,
          mimetype: ctx.quoted.stickerMessage?.mimetype || "image/webp",
        });
        await ctx.react("✅");
        return;
      }

      if (type === "image") {
        await ctx.react("⏳");

        const quotedMsgInfo = this.getQuotedMessageInfo(ctx);
        if (!quotedMsgInfo) {
          await ctx.react("❌");
          await ctx.reply("❌ No se pudo obtener la imagen referenciada.");
          return;
        }

        const buffer = (await downloadMediaMessage(
          quotedMsgInfo,
          "buffer",
          {},
        )) as Buffer;

        const originalCaption = ctx.quoted.imageMessage?.caption || "";
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
          mimetype: ctx.quoted.imageMessage?.mimetype || "image/jpeg",
        });
        await ctx.react("✅");
        return;
      }

      if (type === "video") {
        await ctx.react("⏳");

        const quotedMsgInfo = this.getQuotedMessageInfo(ctx);
        if (!quotedMsgInfo) {
          await ctx.react("❌");
          await ctx.reply("❌ No se pudo obtener el video referenciado.");
          return;
        }

        const buffer = (await downloadMediaMessage(
          quotedMsgInfo,
          "buffer",
          {},
        )) as Buffer;

        const originalCaption = ctx.quoted.videoMessage?.caption || "";
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
          mimetype: ctx.quoted.videoMessage?.mimetype || "video/mp4",
          gifPlayback: ctx.quoted.videoMessage?.gifPlayback || false,
        });
        await ctx.react("✅");
        return;
      }

      if (type === "audio") {
        if (extraText) {
          await ctx.sock.sendMessage(ctx.chat.jid, {
            text: `${extraText}${footer}`,
            mentions: participants,
          });
        }

        const quotedMsgInfo = this.getQuotedMessageInfo(ctx);
        if (quotedMsgInfo) {
          const buffer = (await downloadMediaMessage(
            quotedMsgInfo,
            "buffer",
            {},
          )) as Buffer;
          await ctx.sock.sendMessage(ctx.chat.jid, {
            audio: buffer,
            mentions: participants,
            mimetype:
              ctx.quoted.audioMessage?.mimetype || "audio/ogg; codecs=opus",
            ptt: ctx.quoted.audioMessage?.ptt || false,
          });
        }
        await ctx.react("✅");
        return;
      }

      if (type === "document") {
        if (extraText) {
          await ctx.sock.sendMessage(ctx.chat.jid, {
            text: `${extraText}${footer}`,
            mentions: participants,
          });
        }

        const quotedMsgInfo = this.getQuotedMessageInfo(ctx);
        if (quotedMsgInfo) {
          await ctx.sock.relayMessage(ctx.chat.jid, quotedMsgInfo.message!, {
            messageId: ctx.sock.generateMessageTag(),
          });
        }
        await ctx.react("✅");
        return;
      }

      const quotedText =
        ctx.quoted.conversation || ctx.quoted.extendedTextMessage?.text || "";

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
      await ctx.react("✅");
    } catch (error) {
      console.error("Error in NotifyCommand:", error);
      await ctx.react("❌");
      await ctx.reply("❌ Error al enviar la notificación.");
    }
  }
}
