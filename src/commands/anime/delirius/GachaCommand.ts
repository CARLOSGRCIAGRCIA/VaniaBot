import { Command } from '../../Command.js';
import { DeliriusAnimeBase } from '../DeliriusAnimeBase.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class GachaCommand extends Command {
  name = 'gacha';
  description = 'Obtiene un personaje aleatorio de gacha';
  category = CommandCategory.ANIME;
  aliases = [];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!gacha';
  examples = ['!gacha'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🎰');
    await new DeliriusAnimeBase().sendImage(ctx, 'gacha');
  }
}
