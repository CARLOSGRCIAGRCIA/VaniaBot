import { Command } from '../../Command.js';
import { CanvasBase } from './CanvasBase.js';
import { ImageHelper } from '@/utils/ImageHelper.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class BalcardCommand extends Command {
  name = 'balcard';
  description = 'Genera tarjeta de balance';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!balcard [background] [username] [discriminator] [money] [xp] [level]';
  examples = ['!balcard #000000 usuario 0001 1000 500 5'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('💳');

    const imageUrl = await ImageHelper.getProfileImage(ctx);
    if (!imageUrl) {
      await ctx.reply('❌ No pude obtener la foto de perfil.');
      return;
    }

    const args = ctx.args || [];
    const background = args[0] || 'black';
    const username = args[1] || ctx.sender.pushName || 'User';
    const discriminator = args[2] || '0000';
    const money = args[3] || '0';
    const xp = args[4] || '0';
    const level = args[5] || '1';

    await new CanvasBase().sendImage(ctx, 'balcard', {
      url: imageUrl,
      background,
      username: username.substring(0, 20),
      discriminator,
      money,
      xp,
      level,
    });
  }
}
