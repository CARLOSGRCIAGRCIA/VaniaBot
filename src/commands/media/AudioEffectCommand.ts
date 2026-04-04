import { Command } from '../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { downloadMediaMessage, type WAMessage } from '@whiskeysockets/baileys';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '@/utils/logger.js';

const execAsync = promisify(exec);
const getRandom = (ext: string) => `${Math.floor(Math.random() * 10000)}${ext}`;
const TMP_DIR = path.join(os.tmpdir(), 'vaniabot-audio');

const EFFECTS: Record<string, { filter: string; description: string }> = {
  bass: { filter: '-af equalizer=f=94:width_type=o:width=2:g=30', description: 'Bass' },
  deep: { filter: '-af atempo=4/4,asetrate=44500*2/3', description: 'Deep' },
  fast: { filter: '-filter:a "atempo=1.63,asetrate=44100"', description: 'Fast' },
  slow: { filter: '-filter:a "atempo=0.7,asetrate=44100"', description: 'Slow' },
  nightcore: { filter: '-af atempo=1.06,asetrate=44100*1.25', description: 'Nightcore' },
  robot: {
    filter:
      "-filter_complex \"afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75\"",
    description: 'Robot',
  },
  tupai: { filter: '-filter:a "atempo=0.5,asetrate=65100"', description: 'Tupai/Chipmunk' },
  reverse: { filter: '-filter_complex "areverse"', description: 'Reverse' },
  earrape: { filter: '-af volume=12', description: 'Earrape' },
  smooth: {
    filter: '-filter:v "minterpolate=\'mi_mode=mci:mc_mode=aobmc:vsbmc=1:fps=120\'"',
    description: 'Smooth',
  },
  blown: { filter: '-af acrusher=.1:1:64:0:log', description: 'Blown' },
  fat: { filter: '-filter:a "atempo=1.6,asetrate=22100"', description: 'Fat' },
};

export class AudioEffectCommand extends Command {
  name = 'audiofx';
  description = 'Aplicar efectos de audio';
  category = CommandCategory.MEDIA;
  aliases = Object.keys(EFFECTS);
  usage = '!<efecto> responde a un audio';
  examples = Object.keys(EFFECTS).map(e => `!${e} (responde a audio)`);
  cooldown = 30_000;

  async execute(ctx: MessageContext): Promise<void> {
    const commandName = ctx.command.toLowerCase();
    const effect = EFFECTS[commandName];

    if (!effect) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *efectos disponibles* ˚₊· ͟͟͞͞➳\n\n` +
          Object.keys(EFFECTS)
            .map(e => `✿ *!${e}*`)
            .join('\n') +
          `\n\n✩ Responde a un audio con el comando.`,
      );
      return;
    }

    if (!ctx.quoted) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *falta el audio* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ Responde a un *audio/nota de voz* con *!${commandName}*`,
      );
      return;
    }

    const mime = ctx.quoted.audioMessage?.mimetype || '';
    if (!mime.includes('audio')) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *no es audio* ˚₊· ͟͟͞͞➳\n\n` + `✿ Necesito que respondas a un *audio/nota de voz*.`,
      );
      return;
    }

    await ctx.react('⏳');

    try {
      if (!fs.existsSync(TMP_DIR)) {
        fs.mkdirSync(TMP_DIR, { recursive: true });
      }

      const quotedMsg = ctx.quoted;
      const quotedAsMessage: WAMessage = {
        key: ctx.message.key,
        message: quotedMsg,
      } as WAMessage;
      const mediaBuffer = await downloadMediaMessage(quotedAsMessage, 'buffer', {});
      const inputFile = path.join(TMP_DIR, `input_${getRandom('.mp3')}`);
      const outputFile = path.join(TMP_DIR, `output_${getRandom('.mp3')}`);

      fs.writeFileSync(inputFile, mediaBuffer);

      const ffmpegCommand = `ffmpeg -i "${inputFile}" ${effect.filter} "${outputFile}"`;

      await execAsync(ffmpegCommand);

      const outputBuffer = fs.readFileSync(outputFile);

      await ctx.sock.sendMessage(ctx.chat.jid, {
        audio: outputBuffer,
        mimetype: 'audio/mpeg',
        ptt: true,
      });

      fs.unlinkSync(inputFile);
      fs.unlinkSync(outputFile);

      await ctx.react('✅');
    } catch (error) {
      logger.error('[AudioEffectCommand] Error:', error);
      await ctx.react('❌');
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *error* ˚₊· ͟͟͞͞➳\n\n` + `❌ No pude aplicar el efecto. Intenta con otro audio.`,
      );
    }
  }
}
