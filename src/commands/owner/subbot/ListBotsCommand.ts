import { Command } from '../../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import { subBotManager } from '@/services/subbot/SubBotManager.js';

export class ListBotsCommand extends Command {
  name = 'listbots';
  description = 'Lista todas las subbots (solo owner)';
  category = CommandCategory.SUBBOT;
  aliases = ['subbots', 'allbots'];
  usage = '.listbots';
  examples = ['.listbots'];
  contexts = [CommandContext.BOTH];
  permissions = { user: [PermissionLevel.OWNER] };

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.sender.isOwner) {
      await ctx.reply('❌ Solo la owner puede usar este comando.');
      return;
    }

    const all = subBotManager.getAllStatus();

    if (all.length === 0) {
      await ctx.reply(
        `╔═══════════════════════════╗\n` +
          `║  🌸 *VaniaBot — SubBots*    ║\n` +
          `╚═══════════════════════════╝\n\n` +
          `_No hay subbots registradas aún_ 🦋\n\n` +
          `_— VaniaBot 🌸_`,
      );
      return;
    }

    const statusEmoji: Record<string, string> = {
      pending: '⏳',
      connecting: '🔄',
      connected: '✅',
      disconnected: '❌',
      error: '⚠️',
    };

    const connected = all.filter(s => s.status === 'connected').length;

    let text =
      `╔═══════════════════════════╗\n` +
      `║  🌸 *VaniaBot — SubBots*    ║\n` +
      `╚═══════════════════════════╝\n\n` +
      `📊 Total: *${all.length}* | ✅ Activas: *${connected}*\n\n`;

    for (const s of all) {
      text +=
        `${statusEmoji[s.status] ?? '❓'} *${s.name}*\n` +
        `   📞 +${s.phoneNumber}\n` +
        `   🆔 \`${s.id}\`\n\n`;
    }

    text += `_— VaniaBot 🌸_`;

    await ctx.reply(text.trim());
  }
}
