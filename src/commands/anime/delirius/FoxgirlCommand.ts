import { Command } from '../../Command.js';
import { DeliriusAnimeBase } from '../DeliriusAnimeBase.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class FoxgirlCommand extends Command {
  name = 'foxgirl';
  description = 'Obtiene una imagen de foxgirl anime';
  category = CommandCategory.ANIME;
  aliases = ['foxgirl', 'kitsune'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!foxgirl';
  examples = ['!foxgirl'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🦊');
    await new DeliriusAnimeBase().sendImage(ctx, 'foxgirl');
  }
}
