import { Command } from '../../Command.js';
import { StickerHelper } from '@/utils/StickerHelper.js';
import { canvasService } from '@/services/external/CanvasService.js';
import { contactsCache } from '@/utils/ContactsCache.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

async function getContactName(ctx: MessageContext, jid: string): Promise<string> {
  const cached = contactsCache.get(jid);
  if (cached) return cached;

  try {
    const groupMeta = await ctx.sock.groupMetadata(ctx.chat.jid);
    const targetBase = jid.split('@')[0].split(':')[0];

    const participant = groupMeta.participants.find(p => {
      const pBase = p.id.split('@')[0].split(':')[0];
      return pBase === targetBase;
    });

    if (participant) {
      const name = participant.notify || participant?.name || participant?.verifiedName;

      if (name) {
        contactsCache.set(participant.id, name);
        return name;
      }
    }
  } catch {}

  return `@${jid.split('@')[0]}`;
}

export class BratCommand extends Command {
  name = 'brat';
  description = 'Genera imagen estilo Brat';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!brat <texto | @usuario>';
  examples = ['!brat VaniaBot', '!brat @usuario'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const mentioned = ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    let text: string;

    if (mentioned) {
      text = await getContactName(ctx, mentioned);
    } else {
      text =
        ctx.args
          ?.filter(arg => !/^@\S+$/.test(arg))
          .join(' ')
          .trim() ?? '';
    }

    if (!text) {
      await ctx.reply('✍️ *Uso:* !brat <texto | @usuario>\n_Ejemplo: !brat VaniaBot_');
      return;
    }

    await ctx.react('🎨');

    try {
      const result = await canvasService.getResult('brat', { text });

      let stickerBuffer: Buffer;

      if (result.type === 'url') {
        stickerBuffer = await StickerHelper.imageUrlToSticker(result.url);
      } else {
        const { buffer, contentType } = result;
        const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
        stickerBuffer = await StickerHelper.imageUrlToSticker(dataUrl);
      }

      await ctx.sock.sendMessage(ctx.chat.jid, { sticker: stickerBuffer });
      await ctx.react('✅');
    } catch {
      await ctx.react('❌');
      await ctx.reply('❌ No pude generar el sticker. Intenta de nuevo.');
    }
  }
}
