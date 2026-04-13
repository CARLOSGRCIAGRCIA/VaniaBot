import { Command } from '../../Command.js';
import { AnimeBase } from '../AnimeBase.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class HnekoCommand extends Command {
  name = 'hneko';
  description = 'Obtiene una imagen aleatoria de hneko NSFW';
  category = CommandCategory.ANIME;
  aliases = ['hneko', 'hnekonsfw', 'nekonsfw'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!hneko';
  examples = ['!hneko'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('😺');
    await new AnimeBase().sendImage(ctx, 'hneko');
  }
}
