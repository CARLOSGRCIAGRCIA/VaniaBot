import { Command } from '../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { downloadMediaMessage, type proto } from '@whiskeysockets/baileys';
import axios from 'axios';
import { env } from '@/config/env.js';

export class ToAnimeCommand extends Command {
  name = 'toanime';
  description = 'Convertir imagen a estilo anime';
  category = CommandCategory.MEDIA;
  aliases = ['toanime', 'toghibli'];
  usage = '!toanime (responde a imagen)';
  examples = ['!toanime'];
  cooldown = 30_000;

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.quoted || !ctx.quoted.imageMessage) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *falta la imagen* ˚₊· ͟͟͞͞➳\n\n` + `✿ Responde a una *imagen* con *!toanime*`,
      );
      return;
    }

    const mime = ctx.quoted.imageMessage.mimetype || '';
    if (!mime.startsWith('image/')) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *no es imagen* ˚₊· ͟͟͞͞➳\n\n` + `✿ Necesito que respondas a una *imagen*.`,
      );
      return;
    }

    if (!env.DEEPAI_API_KEY) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *API no configurada* ˚₊· ͟͟͞͞➳\n\n` +
          `❌ No tienes configurada la API de DeepAI.\n\n` +
          `Para activar esta función:\n` +
          `1. Regístrate en https://deepai.org\n` +
          `2. Ve a https://deepai.org/dashboard\n` +
          `3. Copia tu API key\n` +
          `4. Agrégala en .env como:\n` +
          `DEEPAI_API_KEY=tu_key`,
      );
      return;
    }

    await ctx.react('⏳');
    await ctx.reply(`˚₊· ͟͟͞͞➳ *convirtiendo a anime...* ˚₊· ͟͟͞͞➳`);

    try {
      const fakeMsg = { message: ctx.quoted } as unknown as proto.IWebMessageInfo;
      const imageBuffer = await downloadMediaMessage(fakeMsg, 'buffer', {});

      const tempPath = `/tmp/toanime_${Date.now()}.jpg`;
      const fs = await import('fs');
      fs.writeFileSync(tempPath, imageBuffer);

      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      formData.append('image', fs.createReadStream(tempPath));

      const response = await axios.postForm('https://api.deepai.org/api/toonify', formData, {
        headers: {
          'api-key': env.DEEPAI_API_KEY,
        },
        timeout: 60000,
      });

      fs.unlinkSync(tempPath);

      if (response.data?.output_url) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: { url: response.data.output_url },
          caption: '˚₊· ͟͟͞͞➳ *listo* ˚₊· ͟͟͞͞➳',
        });
        await ctx.react('✅');
      } else {
        throw new Error('No se pudo obtener la imagen');
      }
    } catch (error: unknown) {
      console.error('[ToAnimeCommand] Error:', error);
      await ctx.react('❌');
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *error* ˚₊· ͟͟͞͞➳\n\n` + `❌ No pude convertir la imagen. Intenta con otra.`,
      );
    }
  }
}
