import { Command } from '../../Command.js';
import { AnimeBase } from '../AnimeBase.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class MilfCommand extends Command {
  name = 'milf';
  description = 'Obtiene una imagen aleatoria de MILF';
  category = CommandCategory.ANIME;
  aliases = ['milf', 'milfs'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!milf';
  examples = ['!milf'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🔥');
    await new AnimeBase().sendImage(ctx, 'milf');
  }
}
