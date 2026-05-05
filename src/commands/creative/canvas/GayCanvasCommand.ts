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

export class GayCommand extends Command {
  name = 'gay';
  description = 'Calcula el porcentaje gay y genera imagen con efecto arcoíris';
  category = CommandCategory.CREATIVE;
  aliases = ['gayrate', 'gaymeter'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!gay [@usuario]';
  examples = ['!gay', '!gay @usuario'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🌈');

    const mentioned = ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    let imageUrl: string | null = null;
    let targetTag: string;
    let targetJid: string;

    if (mentioned) {
      targetJid = mentioned;
      targetTag = await getContactName(ctx, mentioned);
      try {
        const pic = await ctx.sock.profilePictureUrl(mentioned, 'image');
        imageUrl = pic ?? null;
      } catch {}
    } else {
      targetJid = ctx.sender.jid;
      targetTag = ctx.sender.pushName || (await getContactName(ctx, ctx.sender.jid));
      imageUrl = await ImageHelper.getProfileImage(ctx);
    }

    if (!imageUrl) imageUrl = await ImageHelper.getProfileImage(ctx);

    if (!imageUrl) {
      await ctx.reply('❌ No pude obtener la foto de perfil.');
      return;
    }

    const base = targetJid
      .split('')
      .reduce((sum: number, char: string) => sum + char.charCodeAt(0), 0);
    const percent = ((base % 101) + Math.floor(Math.random() * 7)) % 101;

    const messages = [
      `🌈 *${targetTag}* es ${percent}% homosexual 🏳️🌈`,
      `💖 Compatibilidad con arcoíris: ${percent}% para *${targetTag}* ✨`,
      `*${targetTag}* tiene un ${percent}% de magia under the rainbow 🌟`,
      `🏳️🌈 *${targetTag}* level: ${percent}% diva 💃`,
      `✨ El universo dice que *${targetTag}* es ${percent}% fabuloso 💅`,
      `🌈 *${targetTag}* está ${percent}% seguro de sí mismo 🎀`,
      `💅 *${targetTag}*: ${percent}% de personalidad drag 👑`,
      `🏳️🌈 *${targetTag}* brilla con ${percent}% de intensidad arcoíris ✨`,
    ];

    const message = messages[Math.floor(Math.random() * messages.length)];

    await new CanvasBase().sendImageWithCaption(ctx, 'gay', { url: imageUrl }, message);
  }
}
