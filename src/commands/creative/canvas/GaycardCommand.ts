import { Command } from '../../Command.js';
import { CanvasBase } from './CanvasBase.js';
import { ImageHelper } from '@/utils/ImageHelper.js';
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

function generateRank(jid: string): string {
  const seed = jid.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const daily = Math.floor(Date.now() / 86400000);
  const base = ((seed * 31 + daily * 7) % 9) + 1;
  const jitter = Math.floor(Math.random() * 3);
  return String(Math.min(base + jitter, 10));
}

export class GaycardCommand extends Command {
  name = 'gaycard';
  description = 'Genera tarjeta gay';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!gaycard [@usuario]';
  examples = ['!gaycard', '!gaycard @usuario'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🌈');

    const mentioned = ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    let imageUrl: string | null = null;
    let name: string;
    let targetJid: string;

    if (mentioned) {
      targetJid = mentioned;
      name = await getContactName(ctx, mentioned);
      try {
        const pic = await ctx.sock.profilePictureUrl(mentioned, 'image');
        imageUrl = pic ?? null;
      } catch {}
    } else {
      targetJid = ctx.sender.jid;
      name = ctx.sender.pushName || (await getContactName(ctx, ctx.sender.jid));
      imageUrl = await ImageHelper.getProfileImage(ctx);
    }

    if (!imageUrl) imageUrl = await ImageHelper.getProfileImage(ctx);

    const rank = generateRank(targetJid);

    const params: Record<string, string> = {
      name: name.substring(0, 20),
      rank,
    };

    if (imageUrl) params.url = imageUrl;

    await new CanvasBase().sendImage(ctx, 'gaycard', params);
  }
}
