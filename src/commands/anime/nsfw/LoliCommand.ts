import { Command } from '../../Command.js';
import { AnimeBase } from '../AnimeBase.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class LoliCommand extends Command {
  name = 'loli';
  description = 'Obtiene una imagen aleatoria de loli';
  category = CommandCategory.ANIME;
  aliases = ['loli', 'lolicon'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!loli';
  examples = ['!loli'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🍬');
    await new AnimeBase().sendImage(ctx, 'loli');
  }
}
