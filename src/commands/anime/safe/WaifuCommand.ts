import { Command } from '../../Command.js';
import { AnimeBase } from '../AnimeBase.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class WaifuCommand extends Command {
  name = 'waifu';
  description = 'Obtiene una imagen aleatoria de waifu';
  category = CommandCategory.ANIME;
  aliases = ['waifu', 'waifus'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!waifu';
  examples = ['!waifu'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('💕');
    await new AnimeBase().sendImage(ctx, 'waifu');
  }
}
