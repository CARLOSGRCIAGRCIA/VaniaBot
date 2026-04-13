import { Command } from '../../Command.js';
import { AnimeBase } from '../AnimeBase.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class HwaifuCommand extends Command {
  name = 'hwaifu';
  description = 'Obtiene una imagen aleatoria de hwaifu NSFW';
  category = CommandCategory.ANIME;
  aliases = ['hwaifu', 'hwaifunsfw'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!hwaifu';
  examples = ['!hwaifu'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('💖');
    await new AnimeBase().sendImage(ctx, 'hwaifu');
  }
}
