import { Command } from '../../Command.js';
import { DeliriusAnimeBase } from '../DeliriusAnimeBase.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class MaidCommand extends Command {
  name = 'maid';
  description = 'Obtiene una imagen de maid anime';
  category = CommandCategory.ANIME;
  aliases = [];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!maid';
  examples = ['!maid'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('👗');
    await new DeliriusAnimeBase().sendImage(ctx, 'maid');
  }
}
