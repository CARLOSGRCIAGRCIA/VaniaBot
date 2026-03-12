import { Command } from '../../Command.js';
import { audioService } from '@/services/audio/AudioService.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import { downloadMediaMessage, type WAMessage } from '@whiskeysockets/baileys';

const WHISPER_LANGS: Record<string, string> = {
  es: 'es',
  español: 'es',
  spanish: 'es',
  en: 'en',
  inglés: 'en',
  ingles: 'en',
  english: 'en',
  pt: 'pt',
  portugués: 'pt',
  portugues: 'pt',
  fr: 'fr',
  francés: 'fr',
  frances: 'fr',
  french: 'fr',
  de: 'de',
  alemán: 'de',
  aleman: 'de',
  german: 'de',
  it: 'it',
  italiano: 'it',
  italian: 'it',
  ja: 'ja',
  japonés: 'ja',
  japones: 'ja',
  japanese: 'ja',
  ko: 'ko',
  coreano: 'ko',
  korean: 'ko',
  zh: 'zh',
  chino: 'zh',
  chinese: 'zh',
  ru: 'ru',
  ruso: 'ru',
  russian: 'ru',
  ar: 'ar',
  árabe: 'ar',
  arabe: 'ar',
  arabic: 'ar',
  hi: 'hi',
  hindi: 'hi',
  nl: 'nl',
  holandés: 'nl',
  dutch: 'nl',
  tr: 'tr',
  turco: 'tr',
  turkish: 'tr',
  pl: 'pl',
  polaco: 'pl',
  polish: 'pl',
  sv: 'sv',
  sueco: 'sv',
  swedish: 'sv',
  uk: 'uk',
  ucraniano: 'uk',
  ukrainian: 'uk',
  id: 'id',
  indonesio: 'id',
  vi: 'vi',
  vietnamita: 'vi',
};

interface AudioData {
  buffer: Buffer;
  extension: string;
  esNotaDeVoz: boolean;
}

export async function extractAudio(ctx: MessageContext): Promise<AudioData | null> {
  const currentMsg = ctx.message.message;
  const quotedMsg = ctx.quoted;

  const targets = [
    { msg: ctx.message as unknown as WAMessage, content: currentMsg },
    {
      msg: { key: ctx.message.key, message: quotedMsg } as unknown as WAMessage,
      content: quotedMsg,
    },
  ];

  for (const { msg, content } of targets) {
    if (!content) continue;

    if (content.audioMessage) {
      try {
        const buffer = (await downloadMediaMessage(msg, 'buffer', {})) as Buffer;
        const esNotaDeVoz = content.audioMessage.ptt === true;
        const ext = esNotaDeVoz ? 'ogg' : 'mp3';
        return { buffer, extension: ext, esNotaDeVoz };
      } catch {
        continue;
      }
    }

    if (content.documentMessage) {
      const mime = content.documentMessage.mimetype ?? '';
      if (!mime.startsWith('audio/')) continue;
      try {
        const buffer = (await downloadMediaMessage(msg, 'buffer', {})) as Buffer;
        const ext = mime.split('/')[1]?.split(';')[0] ?? 'mp3';
        return { buffer, extension: ext, esNotaDeVoz: false };
      } catch {
        continue;
      }
    }

    if (content.videoMessage) {
      try {
        const buffer = (await downloadMediaMessage(msg, 'buffer', {})) as Buffer;
        return { buffer, extension: 'mp4', esNotaDeVoz: false };
      } catch {
        continue;
      }
    }
  }

  return null;
}

export class TranscribeCommand extends Command {
  name = 'transcribe';
  description = 'Transcribe audio/notas de voz a texto con IA, compresión y resumen';
  category = CommandCategory.UTILITY;
  aliases = ['voz', 'voice', 'stt', 'texto', 'audio'];
  usage = '!transcribe [resumen|completo|idioma]';
  examples = [
    '!transcribe  (enviando una nota de voz)',
    '!transcribe  (respondiendo un audio)',
    '!transcribe resumen',
    '!transcribe completo',
    '!transcribe en  (forzar inglés)',
    '!transcribe es resumen',
  ];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = [...(ctx.args ?? [])].map(a => a.toLowerCase());

    const audioData = await extractAudio(ctx);

    if (!audioData) {
      await ctx.reply(
        `🎙️ *Transcriptor de Voz — VaniaBot*\n` +
          `━━━━━━━━━━━\n\n` +
          `Envía o responde un audio con *!transcribe* para convertirlo a texto.\n\n` +
          `🛠️ *Modos disponibles:*\n` +
          `• *!transcribe* — transcripción simple\n` +
          `• *!transcribe resumen* — transcripción + resumen + puntos clave\n` +
          `• *!transcribe completo* — transcripción + análisis + metadata\n\n` +
          `🌍 *Forzar idioma:*\n` +
          `• *!transcribe en* — inglés\n` +
          `• *!transcribe es resumen* — español + resumen\n\n` +
          `✅ *Formatos soportados:*\n` +
          `Notas de voz · mp3 · ogg · mp4 · wav · flac · webm\n\n` +
          `⚡ *Extras:*\n` +
          `• Compresión automática para audios grandes\n` +
          `• Filtros de voz (reducción de ruido)\n` +
          `• Detección de tipo: voz, música, silencio\n\n` +
          `> _VaniaBot🎙️ — Transcriptor IA_`,
      );
      return;
    }

    let modo: 'simple' | 'completo' | 'resumen' = 'simple';
    let idioma: string | undefined;

    for (const arg of args) {
      if (arg === 'resumen' || arg === 'summary') {
        modo = 'resumen';
        continue;
      }
      if (arg === 'completo' || arg === 'full') {
        modo = 'completo';
        continue;
      }
      if (WHISPER_LANGS[arg]) {
        idioma = WHISPER_LANGS[arg];
        continue;
      }
    }

    await ctx.react('🎙️');

    const tamañoMB = audioData.buffer.length / 1024 / 1024;
    const needsCompression = tamañoMB > 5;

    if (needsCompression) {
      await ctx.reply(`🔄 Comprimiendo audio (${tamañoMB.toFixed(1)} MB)...`);
    } else {
      await ctx.reply(`🎙️ Transcribiendo audio...`);
    }

    const result = await audioService.procesarCompleto({
      buffer: audioData.buffer,
      extension: audioData.extension,
      esNotaDeVoz: audioData.esNotaDeVoz,
      resumir: modo === 'resumen',
      idioma,
    });

    if (!result.success) {
      await ctx.react('❌');
      await ctx.reply(`❌ ${result.error}`);
      return;
    }

    if (result.analisis?.tipo === 'musica') {
      await ctx.reply(
        `⚠️ *Nota:* El audio parece contener música. La transcripción puede no ser precisa.\n` +
          `_Whisper está optimizado para voz humana._`,
      );
    }

    if (result.analisis?.tipo === 'ruido') {
      await ctx.reply(
        `⚠️ *Nota:* Se detectó mucho ruido de fondo. La transcripción puede tener errores.\n` +
          `_Intenta con un audio con menos ruido._`,
      );
    }

    await ctx.react('✅');
    await ctx.reply(audioService.formatearResultado(result, modo));
  }
}
