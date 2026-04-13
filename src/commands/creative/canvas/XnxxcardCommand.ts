import { Command } from '../../Command.js';
import { CanvasBase } from './CanvasBase.js';
import { ImageHelper } from '@/utils/ImageHelper.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class XnxxcardCommand extends Command {
  name = 'xnxxcard';
  description = 'Genera tarjeta estilo XNXX';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!xnxxcard <titulo>';
  examples = ['!xnxxcard Mi Video'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args || [];
    if (args.length < 1) {
      await ctx.reply('✍️ *Uso:* !xnxxcard <titulo>\n_Ejemplo: !xnxxcard Mi Video_');
      return;
    }

    const title = args.join(' ').substring(0, 30);
    const userTag = ctx.sender.pushName
      ? `@${ctx.sender.pushName.replace(/\s+/g, '')}`
      : `@${ctx.sender.jid.split('@')[0]}`;

    await ctx.react('🎬');

    let imageUrl = await ImageHelper.getImageOrProfile(ctx);
    if (!imageUrl) {
      imageUrl = await ImageHelper.getProfileImage(ctx);
    }

    if (!imageUrl) {
      await ctx.reply('❌ No pude obtener la foto de perfil.');
      return;
    }

    await new CanvasBase().sendImage(ctx, 'xnxxcard', {
      image: imageUrl,
      title,
      username: userTag,
    });
  }
}
