import { Command } from '../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

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
    const groupJid = ctx.chat.isGroup ? ctx.chat.jid : null;

    if (!action || action === 'status') {
      const status = nsfwEnabled ? '✅ *HABILITADOS*' : '❌ *DESHABILITADOS*';
      let groupStatus = '';
      if (groupJid) {
        try {
          const group = await serviceManager.groupService.getGroup(groupJid);
          groupStatus = group.nsfw
            ? '\n📌 *Este grupo:* ✅ habilitado'
            : '\n📌 *Este grupo:* ❌ deshabilitado';
        } catch {
          groupStatus = '\n📌 *Este grupo:* ⚠️ no verificado';
        }
      }
      await ctx.reply(`🔞 *NSFW global:* ${status}${groupStatus}\n\nUsa: !nsfw on/off`);
      return;
    }

    if (action === 'on') {
      nsfwEnabled = true;
      if (groupJid) {
        await serviceManager.groupService.toggleNSFW(groupJid, true);
      }
      await ctx.reply('✅ *Comandos NSFW habilitados*');
    } else if (action === 'off') {
      nsfwEnabled = false;
      if (groupJid) {
        await serviceManager.groupService.toggleNSFW(groupJid, false);
      }
      await ctx.reply('❌ *Comandos NSFW deshabilitados*');
    } else {
      await ctx.reply('✍️ *Uso:* !nsfw <on/off/status>');
    }
  }

  static isEnabled(): boolean {
    return nsfwEnabled;
  }
}
