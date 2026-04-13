import { Command } from '../../Command.js';
import { DeliriusAnimeBase } from '../DeliriusAnimeBase.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class SelfieCommand extends Command {
  name = 'selfie';
  description = 'Obtiene una imagen de selfie anime';
  category = CommandCategory.ANIME;
  aliases = [];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!selfie';
  examples = ['!selfie'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('📸');
    await new DeliriusAnimeBase().sendImage(ctx, 'selfie');
  }
}
