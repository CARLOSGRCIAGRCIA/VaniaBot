import { Command } from '../../Command.js';
import { CanvasBase } from './CanvasBase.js';
import { ImageHelper } from '@/utils/ImageHelper.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
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
  usage = '!balcard [background]';
  examples = ['!balcard', '!balcard #000000'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('💳');

    const imageUrl = await ImageHelper.getProfileImage(ctx);
    if (!imageUrl) {
      await ctx.reply('❌ No pude obtener la foto de perfil.');
      return;
    }

    const targetJid = ctx.sender.jid;
    const userData = await serviceManager.userService.getUser(targetJid);

    const args = ctx.args || [];
    const background = args[0] || 'black';

    const username = userData.name || ctx.sender.pushName || 'User';
    const discriminator = userData.name ? userData.name.slice(-4) : '0000';
    const money = userData.money.toString();
    const xp = userData.xp.toString();
    const level = userData.level.toString();

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
