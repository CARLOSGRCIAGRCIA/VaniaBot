import { Command } from "../Command.js";
import {
  CommandCategory,
  CommandContext,
  type MessageContext,
} from "@/types/index.js";
import { aiService } from "@/services/external/AIService.js";

export class TranscribeCommand extends Command {
  name = "transcribe";
  description = "Transcribe una nota de voz o audio a texto usando Whisper IA";
  category = CommandCategory.UTILITY;
  aliases = ["voz", "voice", "stt", "texto"];
  usage = "!transcribe  (enviando o respondiendo un audio/nota de voz)";
  examples = [
    "!transcribe  [enviando una nota de voz]",
    "!transcribe  [respondiendo un audio]",
  ];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    const audioResult = await this.extractAudio(ctx);

    if (!audioResult) {
      await ctx.reply(
        "🎙️ *Transcriptor de voz*\n\n" +
          "Envía o responde una nota de voz / audio con *!transcribe* para convertirlo a texto.\n\n" +
          "✅ Soporta: notas de voz, audios de WhatsApp\n" +
          "🌍 Detecta el idioma automáticamente",
      );
      return;
    }

    await ctx.react("🎙️");
    await ctx.reply("🎙️ Transcribiendo audio...");

    const response = await aiService.transcribeAudio(
      audioResult.buffer,
      audioResult.extension,
    );

    if (!response.success) {
      await ctx.react("❌");
      await ctx.reply(`❌ No pude transcribir el audio: ${response.error}`);
      return;
    }

    const text = response.text!.trim();

    if (!text) {
      await ctx.react("❌");
      await ctx.reply("❌ No se detectó voz en el audio.");
      return;
    }

    await ctx.react("✅");
    await ctx.reply(`🎙️ *Transcripción:*\n\n${text}`);
  }

  private async extractAudio(
    ctx: MessageContext,
  ): Promise<{ buffer: Buffer; extension: string } | null> {
    const { downloadMediaMessage } = await import("@whiskeysockets/baileys");

    const currentMsg = ctx.message.message;
    const quotedMsg = ctx.quoted;

    const targets = [
      { msg: ctx.message, content: currentMsg },
      {
        msg: { key: ctx.message.key, message: quotedMsg } as any,
        content: quotedMsg,
      },
    ];

    for (const { msg, content } of targets) {
      if (!content) continue;

      if (content.audioMessage) {
        try {
          const buffer = (await downloadMediaMessage(
            msg,
            "buffer",
            {},
          )) as Buffer;
          const ext = content.audioMessage.ptt ? "ogg" : "mp3";
          return { buffer, extension: ext };
        } catch {
          continue;
        }
      }

      if (content.documentMessage) {
        const mime = content.documentMessage.mimetype ?? "";
        if (!mime.startsWith("audio/")) continue;
        try {
          const buffer = (await downloadMediaMessage(
            msg,
            "buffer",
            {},
          )) as Buffer;
          const ext = mime.split("/")[1]?.split(";")[0] ?? "mp3";
          return { buffer, extension: ext };
        } catch {
          continue;
        }
      }
    }

    return null;
  }
}
