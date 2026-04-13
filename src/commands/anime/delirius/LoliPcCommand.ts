import { Command } from '../../Command.js';
import { DeliriusAnimeBase } from '../DeliriusAnimeBase.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class LoliPcCommand extends Command {
  name = 'lolipc';
  description = 'Obtiene una imagen de loli con PC';
  category = CommandCategory.ANIME;
  aliases = [];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!lolipc';
  examples = ['!lolipc'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('💻');
    await new DeliriusAnimeBase().sendImage(ctx, 'lolipc');
  }
}
