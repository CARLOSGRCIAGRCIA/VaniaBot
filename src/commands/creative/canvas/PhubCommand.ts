import { Command } from '../../Command.js';
import { CanvasBase } from './CanvasBase.js';
import { ImageHelper } from '@/utils/ImageHelper.js';
import { StickerHelper } from '@/utils/StickerHelper.js';
import { findAssetFile } from '@/utils/assetHelper.js';
import { contactsCache } from '@/utils/ContactsCache.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

let cachedDefaultImageUrl: string | null = null;

async function uploadToTmpfiles(buffer: Buffer): Promise<string | null> {
  try {
    const boundary = `----FormBoundary${Date.now()}`;
    const CRLF = '\r\n';
    const header =
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="file"; filename="profileDefault.png"${CRLF}` +
      `Content-Type: image/png${CRLF}` +
      `${CRLF}`;
    const footer = `${CRLF}--${boundary}--${CRLF}`;
    const body = Buffer.concat([
      Buffer.from(header, 'utf-8'),
      buffer,
      Buffer.from(footer, 'utf-8'),
    ]);
    const response = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { data?: { url?: string } };
    const pageUrl = data?.data?.url;
    if (!pageUrl) return null;
    return pageUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
  } catch {
    return null;
  }
}

async function getDefaultImageUrl(): Promise<string | null> {
  if (cachedDefaultImageUrl) return cachedDefaultImageUrl;
  const buffer = findAssetFile('profileDefault.png');
  if (!buffer) return null;
  const url = await uploadToTmpfiles(buffer);
  if (url) cachedDefaultImageUrl = url;
  return url;
}

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

export class PhubCommand extends Command {
  name = 'phub';
  description = 'Genera imagen estilo Pornhub';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!phub <texto>';
  examples = ['!phub Mi contenido'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args || [];
    if (args.length < 1) {
      await ctx.reply('✍️ *Uso:* !phub <texto>\n_Ejemplo: !phub Mi contenido_');
      return;
    }

    const text = args
      .filter(arg => !/^@\S+$/.test(arg))
      .join(' ')
      .trim()
      .substring(0, 30);

    if (!text) {
      await ctx.reply('✍️ *Uso:* !phub <texto>\n_Ejemplo: !phub Mi contenido_');
      return;
    }

    const msg = ctx.message.message;
    const contextInfo =
      msg?.extendedTextMessage?.contextInfo ||
      msg?.imageMessage?.contextInfo ||
      msg?.videoMessage?.contextInfo ||
      msg?.documentMessage?.contextInfo ||
      msg?.audioMessage?.contextInfo ||
      msg?.viewOnceMessage?.message?.extendedTextMessage?.contextInfo ||
      msg?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo ||
      null;

    const mentioned = contextInfo?.mentionedJid?.[0];
    const targetJid = mentioned ?? ctx.sender.jid;

    const username = mentioned
      ? await getContactName(ctx, mentioned)
      : ctx.sender.pushName || (await getContactName(ctx, ctx.sender.jid));

    await ctx.react('🔞');

    let imageUrl: string | null = null;
    try {
      const pic = await ctx.sock.profilePictureUrl(targetJid, 'image');
      imageUrl = pic ?? null;
    } catch {}

    if (!imageUrl) imageUrl = await ImageHelper.getImageOrProfile(ctx);
    if (!imageUrl) imageUrl = await getDefaultImageUrl();

    if (!imageUrl) {
      await ctx.reply('❌ No pude obtener ninguna imagen.');
      return;
    }

    try {
      const canvasImageUrl = await new CanvasBase().getImageUrl('phub', {
        image: imageUrl,
        username,
        text,
      });
      const stickerBuffer = await StickerHelper.imageUrlToSticker(canvasImageUrl);
      await ctx.sock.sendMessage(ctx.chat.jid, { sticker: stickerBuffer });
      await ctx.react('✅');
    } catch {
      await ctx.react('❌');
      await ctx.reply('❌ No pude generar el sticker. Intenta de nuevo.');
    }
  }
}
