import { Command } from '../../Command.js';
import { AnimeBase } from '../AnimeBase.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class KonachanCommand extends Command {
  name = 'konachan';
  description = 'Obtiene una imagen aleatoria de Konachan';
  category = CommandCategory.ANIME;
  aliases = ['konachan', 'kona'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!konachan';
  examples = ['!konachan'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🎌');
    await new AnimeBase().sendImage(ctx, 'konachan');
  }
}
