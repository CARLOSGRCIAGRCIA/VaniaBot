import { Command } from '../../Command.js';
import { DeliriusAnimeBase } from '../DeliriusAnimeBase.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class HentaiVidCommand extends Command {
  name = 'hentaivid';
  description = 'Obtiene un video hentai aleatorio';
  category = CommandCategory.ANIME;
  aliases = ['hentaivideo'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!hentaivid';
  examples = ['!hentaivid'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🎬');
    await new DeliriusAnimeBase().sendImage(ctx, 'hentaivid');
  }
}
