import { Command } from '../../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  BotPermission,
  type MessageContext,
} from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

export class KickCommand extends Command {
  name = 'kick';
  description = 'Kick a user from the group (can rejoin)';
  category = CommandCategory.MODERATION;
  aliases = ['expulsar'];
  usage = '!kick @user [reason]';
  examples = ['!kick @user spam', '!kick @user Breaking rules'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
    bot: [BotPermission.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const mentionedJid = ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (!mentionedJid) {
      await ctx.reply('You must mention a user to kick');
      return;
    }

    if (mentionedJid === ctx.sender.jid) {
      await ctx.reply('You cannot kick yourself');
      return;
    }

    if (mentionedJid === ctx.sock.user?.id.split(':')[0] + '@s.whatsapp.net') {
      await ctx.reply('You cannot kick the bot');
      return;
    }

    const targetUser = await serviceManager.userService.getUser(mentionedJid);
    if (targetUser.isOwner) {
      await ctx.reply('You cannot kick an owner');
      return;
    }

    const reason = ctx.args.slice(1).join(' ') || 'No reason provided';

    await ctx.react('⏳');

    try {
      await serviceManager.moderationService.logAction({
        userId: mentionedJid,
        userName: targetUser.name,
        action: 'kick',
        reason,
        moderator: ctx.sender.pushName || 'Unknown',
        timestamp: Date.now(),
      });

      await ctx.sock.groupParticipantsUpdate(ctx.chat.jid, [mentionedJid], 'remove');

      await ctx.reply(
        `👢 *User Kicked*\n\n` +
          `👤 User: ${targetUser.name}\n` +
          `📝 Reason: ${reason}\n` +
          `👮 By: ${ctx.sender.pushName}\n` +
          `📅 Date: ${new Date().toLocaleString()}\n\n` +
          `ℹ️ User can rejoin with invite link`,
      );

      await ctx.react('✅');
    } catch (error: unknown) {
      logError('KickCommand.execute', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      await ctx.reply(`❌ Error kicking user: ${message}`);
      await ctx.react('❌');
    }
  }
}
