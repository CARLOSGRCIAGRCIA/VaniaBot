import { Command } from '../../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

export class UnmuteCommand extends Command {
  name = 'unmute';
  description = 'Unmute a user';
  category = CommandCategory.MODERATION;
  aliases = ['desmutear'];
  usage = '!unmute @user';
  examples = ['!unmute @user'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const mentionedJid = ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (!mentionedJid) {
      await ctx.reply('❌ You must mention a user to unmute');
      return;
    }

    await ctx.react('⏳');

    try {
      const muteInfo = await serviceManager.moderationService.getMuteInfo(
        ctx.chat.jid,
        mentionedJid,
      );

      if (!muteInfo) {
        await ctx.reply('⚠️ This user is not muted');
        return;
      }

      await serviceManager.moderationService.unmuteUser(ctx.chat.jid, mentionedJid);

      await ctx.reply(
        `🔊 *User Unmuted*\n\n` +
          `👤 User: ${muteInfo.userName}\n` +
          `👮 By: ${ctx.sender.pushName}\n` +
          `📅 Date: ${new Date().toLocaleString()}`,
      );

      await ctx.react('✅');
    } catch (error: unknown) {
      logError('[UnmuteCommand] Error', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      await ctx.reply(`❌ Error unmutting user: ${message}`);
      await ctx.react('❌');
    }
  }
}
