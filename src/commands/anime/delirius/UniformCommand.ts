import { Command } from '../../Command.js';
import { DeliriusAnimeBase } from '../DeliriusAnimeBase.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class UniformCommand extends Command {
  name = 'uniform';
  description = 'Obtiene una imagen de uniforme anime';
  category = CommandCategory.ANIME;
  aliases = [];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!uniform';
  examples = ['!uniform'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🎓');
    await new DeliriusAnimeBase().sendImage(ctx, 'uniform');
  }
}
