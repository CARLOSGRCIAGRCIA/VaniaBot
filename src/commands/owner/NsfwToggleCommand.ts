import { Command } from '../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

let nsfwEnabled = false;

export class NsfwToggleCommand extends Command {
  name = 'nsfw';
  description = 'Habilitar/deshabilitar comandos NSFW';
  category = CommandCategory.OWNER;
  aliases = ['nsfwmode'];
  usage = '!nsfw <on/off/status>';
  examples = ['!nsfw on', '!nsfw off', '!nsfw status'];
  cooldown = 5000;
  contexts = [CommandContext.BOTH];
  permissions = {
    user: [PermissionLevel.OWNER],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const action = ctx.args?.[0]?.toLowerCase();

    if (!action || action === 'status') {
      const status = nsfwEnabled ? '✅ *HABILITADOS*' : '❌ *DESHABILITADOS*';
      await ctx.reply(`🔞 *NSFW:* ${status}\n\nUsa: !nsfw on/off`);
      return;
    }

    if (action === 'on') {
      nsfwEnabled = true;
      await ctx.reply('✅ *Comandos NSFW habilitados*');
    } else if (action === 'off') {
      nsfwEnabled = false;
      await ctx.reply('❌ *Comandos NSFW deshabilitados*');
    } else {
      await ctx.reply('✍️ *Uso:* !nsfw <on/off/status>');
    }
  }

  static isEnabled(): boolean {
    return nsfwEnabled;
  }
}
