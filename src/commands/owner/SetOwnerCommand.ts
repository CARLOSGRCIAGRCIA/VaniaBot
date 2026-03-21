import { Command } from '../Command.js';
import { CommandCategory, PermissionLevel } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

export class SetOwnerCommand extends Command {
  name = 'setowner';
  description = 'Grant or remove owner permissions';
  category = CommandCategory.OWNER;
  aliases = ['makeowner', 'removeowner', 'owner'];
  usage = '!setowner <add|remove> <@user>';
  examples = ['!setowner add @5215551234567', '!setowner remove @5215551234567'];
  permissions = {
    user: [PermissionLevel.OWNER],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args;

    if (args.length < 2) {
      await ctx.reply(
        ` Incorrect usage\n\n` +
          `Usage: ${this.usage}\n\n` +
          `📝 Examples:\n${this.examples.join('\n')}`,
      );
      return;
    }

    const action = args[0].toLowerCase();
    const mentionedJid = ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (!mentionedJid) {
      await ctx.reply(' You must mention a user');
      return;
    }

    if (mentionedJid === ctx.sender.jid) {
      await ctx.reply(' You cannot modify your own owner permissions');
      return;
    }

    try {
      const targetUser = await serviceManager.userService.getUser(mentionedJid);

      switch (action) {
        case 'add':
        case 'grant':
        case 'give':
          if (targetUser.isOwner) {
            await ctx.reply(`⚠️ ${targetUser.name} is already an owner`);
            return;
          }

          const oldStats = {
            level: targetUser.level,
            xp: targetUser.xp,
            money: targetUser.money,
          };

          await serviceManager.userService.setOwner(mentionedJid, true);

          const updatedUser = await serviceManager.userService.getUser(mentionedJid);

          await ctx.reply(
            `✅ ${targetUser.name} is now an owner\n\n` +
              `👑 *Granted privileges:*\n` +
              `• Unlimited permissions\n` +
              `• Infinite resources\n` +
              `• Max stats\n` +
              `• Bypass all restrictions\n` +
              `• Cannot be banned or warned\n\n` +
              `📊 *Stats upgrade:*\n` +
              `• Level: ${oldStats.level} → ${updatedUser.level}\n` +
              `• XP: ${oldStats.xp.toLocaleString()} → ${updatedUser.xp.toLocaleString()}\n` +
              `• Money: $${oldStats.money.toLocaleString()} → $${updatedUser.money.toLocaleString()}`,
          );
          break;

        case 'remove':
        case 'revoke':
        case 'take':
          if (!targetUser.isOwner) {
            await ctx.reply(`⚠️ ${targetUser.name} is not an owner`);
            return;
          }

          const beforeRemoval = {
            level: targetUser.level,
            xp: targetUser.xp,
            money: targetUser.money,
          };

          await serviceManager.userService.setOwner(mentionedJid, false);

          const demotedUser = await serviceManager.userService.getUser(mentionedJid);

          await ctx.reply(
            `✅ Owner permissions removed from ${targetUser.name}\n\n` +
              `📊 *Stats reset:*\n` +
              `• Level: ${beforeRemoval.level} → ${demotedUser.level}\n` +
              `• XP: ${beforeRemoval.xp.toLocaleString()} → ${demotedUser.xp.toLocaleString()}\n` +
              `• Money: $${beforeRemoval.money.toLocaleString()} → $${demotedUser.money.toLocaleString()}\n\n` +
              `⚠️ User has been reset to default values`,
          );
          break;

        default:
          await ctx.reply(' Invalid action. Use: add or remove');
      }
    } catch (error) {
      logError('[SetOwnerCommand] Error', error);
      await ctx.reply(` Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }
}
