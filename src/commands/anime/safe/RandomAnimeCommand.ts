import { Command } from '../../Command.js';
import { AnimeBase } from '../AnimeBase.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class RandomAnimeCommand extends Command {
  name = 'random';
  description = 'Obtiene una imagen aleatoria de anime';
  category = CommandCategory.ANIME;
  aliases = ['random', 'randomanime'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!random';
  examples = ['!random'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🎲');
    await new AnimeBase().sendImage(ctx, 'random');
  }
}
