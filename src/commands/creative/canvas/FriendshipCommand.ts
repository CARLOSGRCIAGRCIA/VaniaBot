import { Command } from '../../Command.js';
import { CanvasBase } from './CanvasBase.js';
import { ImageHelper } from '@/utils/ImageHelper.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class FriendshipCommand extends Command {
  name = 'friendship';
  description = 'Genera imagen de amistad';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!friendship [nombre1] [nombre2] [%] [texto]';
  examples = ['!friendship Juan Maria', '!friendship Juan Maria 80 "Friends"'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🤝');

    const [image1, image2] = await ImageHelper.getTwoProfileImages(ctx);

    const args = ctx.args || [];
    const name1 = args[0] || 'User 1';
    const name2 = args[1] || 'User 2';
    const percentage = args[2] || '50';
    const text = args[3] || 'Friends';

    const params: Record<string, string> = {
      name1: name1.substring(0, 15),
      name2: name2.substring(0, 15),
      percentage,
      text,
    };

    if (image1) params.image1 = image1;
    if (image2) params.image2 = image2;

    await new CanvasBase().sendImage(ctx, 'friendship', params);
  }
}
