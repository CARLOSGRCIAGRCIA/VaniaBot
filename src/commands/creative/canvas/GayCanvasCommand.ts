import { Command } from '../../Command.js';
import { CanvasBase } from './CanvasBase.js';
import { ImageHelper } from '@/utils/ImageHelper.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

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

    const imageUrl = await ImageHelper.getProfileImage(ctx);
    if (!imageUrl) {
      await ctx.reply('❌ No pude obtener la foto de perfil.');
      return;
    }

    const targetTag = ctx.sender.pushName || `@${ctx.sender.jid.split('@')[0]}`;

    const base = ctx.sender.jid
      .toString()
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
