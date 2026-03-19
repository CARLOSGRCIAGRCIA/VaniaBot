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

export class BanCommand extends Command {
  name = 'ban';
  description = 'Ban a user from the group';
  category = CommandCategory.MODERATION;
  aliases = ['banear'];
  usage = '!ban @user [reason]';
  examples = ['!ban @user spam', '!ban @user Breaking rules'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
    bot: [BotPermission.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const mentionedJid = ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (!mentionedJid) {
      await ctx.reply('❌ You must mention a user to ban');
      return;
    }

    if (mentionedJid === ctx.sender.jid) {
      await ctx.reply('❌ You cannot ban yourself');
      return;
    }

    if (mentionedJid === ctx.sock.user?.id.split(':')[0] + '@s.whatsapp.net') {
      await ctx.reply('❌ You cannot ban the bot');
      return;
    }

    const targetUser = await serviceManager.userService.getUser(mentionedJid);
    if (targetUser.isOwner) {
      await ctx.reply('❌ You cannot ban an owner');
      return;
    }

    const reason = ctx.args.slice(1).join(' ') || 'No reason provided';

    await ctx.react('⏳');

    try {
      const isBanned = await serviceManager.moderationService.isBanned(ctx.chat.jid, mentionedJid);

      if (isBanned) {
        await ctx.reply('⚠️ This user is already banned');
        return;
      }

      await serviceManager.moderationService.banUser(
        ctx.chat.jid,
        mentionedJid,
        targetUser.name,
        ctx.sender.pushName || 'Unknown',
        reason,
      );

      await ctx.sock.groupParticipantsUpdate(ctx.chat.jid, [mentionedJid], 'remove');

      await ctx.reply(
        `🔨 *User Banned*\n\n` +
          `👤 User: ${targetUser.name}\n` +
          `📝 Reason: ${reason}\n` +
          `👮 By: ${ctx.sender.pushName}\n` +
          `📅 Date: ${new Date().toLocaleString()}`,
      );

      await ctx.react('✅');
    } catch (error: unknown) {
      logError('BanCommand.execute', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      await ctx.reply(`❌ Error banning user: ${message}`);
      await ctx.react('❌');
    }
  }
}
