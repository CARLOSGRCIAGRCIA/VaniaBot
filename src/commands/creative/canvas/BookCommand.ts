import { Command } from '../../Command.js';
import { CanvasBase } from './CanvasBase.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class BookCommand extends Command {
  name = 'book';
  description = 'Genera imagen de libro';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!book <texto> [footer]';
  examples = ['!book "Mi historia"'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !book <texto> [footer]\n_Ejemplo: !book "Mi historia"_');
      return;
    }

    const footer = ctx.args && ctx.args.length > 1 ? ctx.args.slice(1).join(' ') : 'Delirius Api';

    await ctx.react('📖');
    await new CanvasBase().sendImage(ctx, 'book', {
      text: text.substring(0, 100),
      footer: footer.substring(0, 50),
    });
  }
}
