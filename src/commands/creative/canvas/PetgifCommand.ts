import { Command } from '../../Command.js';
import { CanvasBase } from './CanvasBase.js';
import { ImageHelper } from '@/utils/ImageHelper.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class PetgifCommand extends Command {
  name = 'petgif';
  description = 'Genera GIF de mascota';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!petgif [resolucion] [retraso]';
  examples = ['!petgif', '!petgif 512 100'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args || [];

    await ctx.react('🐾');

    let imageUrl: string | null = null;

    if (args[0] && args[0].startsWith('http')) {
      imageUrl = args[0];
    } else {
      imageUrl = await ImageHelper.getImageOrProfile(ctx);
    }

    if (!imageUrl) {
      imageUrl = await ImageHelper.getProfileImage(ctx);
    }

    if (!imageUrl) {
      await ctx.reply('❌ No pude obtener la foto de perfil.');
      return;
    }

    const resolution = args[args.length - 2] || '512';
    const delay = args[args.length - 1] || '100';

    await new CanvasBase().sendImage(ctx, 'petgif', {
      url: imageUrl,
      resolution,
      delay,
    });
  }
}
