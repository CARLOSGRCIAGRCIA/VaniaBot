import { Command } from '../../Command.js';
import { AnimeBase } from '../AnimeBase.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class MeguminCommand extends Command {
  name = 'megumin';
  description = 'Obtiene una imagen aleatoria de Megumin';
  category = CommandCategory.ANIME;
  aliases = ['megumin', 'meguchan'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!megumin';
  examples = ['!megumin'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('💥');
    await new AnimeBase().sendImage(ctx, 'megumin');
  }
}
