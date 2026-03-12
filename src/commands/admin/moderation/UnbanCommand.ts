import { Command } from '../../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

export class UnbanCommand extends Command {
  name = 'unban';
  description = 'Unban a user from the group';
  category = CommandCategory.MODERATION;
  aliases = ['desbanear'];
  usage = '!unban @user';
  examples = ['!unban @user'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const mentionedJid = ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (!mentionedJid) {
      await ctx.reply('❌ You must mention a user to unban');
      return;
    }

    await ctx.react('⏳');

    try {
      const banInfo = await serviceManager.moderationService.getBanInfo(ctx.chat.jid, mentionedJid);

      if (!banInfo) {
        await ctx.reply('⚠️ This user is not banned');
        return;
      }

      await serviceManager.moderationService.unbanUser(ctx.chat.jid, mentionedJid);

      await ctx.reply(
        `✅ *User Unbanned*\n\n` +
          `👤 User: ${banInfo.userName}\n` +
          `👮 By: ${ctx.sender.pushName}\n` +
          `📅 Date: ${new Date().toLocaleString()}`,
      );

      await ctx.react('✅');
    } catch (error: unknown) {
      console.error('Error in UnbanCommand:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      await ctx.reply(`❌ Error unbanning user: ${message}`);
      await ctx.react('❌');
    }
  }
}
