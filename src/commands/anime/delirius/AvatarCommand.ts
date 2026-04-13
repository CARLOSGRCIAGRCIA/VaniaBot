import { Command } from '../../Command.js';
import { DeliriusAnimeBase } from '../DeliriusAnimeBase.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class AvatarCommand extends Command {
  name = 'avatar';
  description = 'Obtiene un avatar anime aleatorio';
  category = CommandCategory.ANIME;
  aliases = ['avataranime'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!avatar';
  examples = ['!avatar'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🎭');
    await new DeliriusAnimeBase().sendImage(ctx, 'avatar');
  }
}
