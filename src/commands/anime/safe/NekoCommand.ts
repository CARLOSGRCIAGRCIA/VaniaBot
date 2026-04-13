import { Command } from '../../Command.js';
import { AnimeBase } from '../AnimeBase.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class NekoCommand extends Command {
  name = 'neko';
  description = 'Obtiene una imagen aleatoria de neko';
  category = CommandCategory.ANIME;
  aliases = ['neko', 'nekos', 'nekochan'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!neko';
  examples = ['!neko'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🐱');
    await new AnimeBase().sendImage(ctx, 'neko');
  }
}
