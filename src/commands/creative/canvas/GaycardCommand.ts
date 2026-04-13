import { Command } from '../../Command.js';
import { CanvasBase } from './CanvasBase.js';
import { ImageHelper } from '@/utils/ImageHelper.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class GaycardCommand extends Command {
  name = 'gaycard';
  description = 'Genera tarjeta gay';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!gaycard [nombre] [rango]';
  examples = ['!gaycard Juan', '!gaycard Juan 5'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🌈');

    const imageUrl = await ImageHelper.getProfileImage(ctx);

    const args = ctx.args || [];
    const name = args[0] || ctx.sender.pushName || 'User';
    const rank = args[1] || '1';

    const params: Record<string, string> = {
      name: name.substring(0, 20),
      rank,
    };

    if (imageUrl) params.url = imageUrl;

    await new CanvasBase().sendImage(ctx, 'gaycard', params);
  }
}
