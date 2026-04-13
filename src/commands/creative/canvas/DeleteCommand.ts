import { Command } from '../../Command.js';
import { CanvasBase } from './CanvasBase.js';
import { ImageHelper } from '@/utils/ImageHelper.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class DeleteCommand extends Command {
  name = 'delete';
  description = 'Efecto de imagen borrosa (delete)';
  category = CommandCategory.CREATIVE;
  aliases = ['blur'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!delete [@usuario]';
  examples = ['!delete', '!delete @usuario'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🔒');

    const imageUrl = await ImageHelper.getProfileImage(ctx);
    if (!imageUrl) {
      await ctx.reply('❌ No pude obtener la foto de perfil.');
      return;
    }

    await new CanvasBase().sendImage(ctx, 'delete', { url: imageUrl });
  }
}
