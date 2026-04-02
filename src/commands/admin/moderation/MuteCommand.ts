import { Command } from '../../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { getTargetUser, getErrorMessage } from '@/utils/moderationUtils.js';

export class MuteCommand extends Command {
  name = 'mute';
  description = 'Mute a user for a specified duration';
  category = CommandCategory.MODERATION;
  aliases = ['silenciar'];
  usage = '!mute @user <duration> [reason]';
  examples = ['!mute @user 10m spam', '!mute @user 1h Breaking rules', '!mute @user 30m'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const target = getTargetUser(ctx);

    if (!target) {
      await ctx.reply(getErrorMessage('mutear'));
      return;
    }

    const { jid: mentionedJid } = target;

    const cleanArgs = ctx.args.filter(arg => !arg.startsWith('@'));

    if (!cleanArgs.length) {
      await ctx.reply(
        '˚₊· ͟͟͞͞➳ oops, necesito saber por cuánto tiempo ˚₊· ͟͟͞͞➳\n\n' +
          '✿ así lo haces ✿\n' +
          '`!mute @user <tiempo> [razón]`\n\n' +
          '✩ por ejemplo ✩\n' +
          '`10m` ﹒`1h` ﹒`2d`',
      );
      return;
    }

    if (mentionedJid === ctx.sender.jid) {
      await ctx.reply('❌ You cannot mute yourself');
      return;
    }

    const targetUser = await serviceManager.userService.getUser(mentionedJid);
    if (targetUser.isOwner) {
      await ctx.reply('❌ You cannot mute an owner');
      return;
    }

    const durationStr = cleanArgs[0];
    const duration = this.parseDuration(durationStr);

    if (duration === null) {
      await ctx.reply(
        '˚₊· ͟͟͞͞➳ oops, ese formato no lo conozco ˚₊· ͟͟͞͞➳\n\n' +
          '✿ así me gusta ✿\n' +
          '`10m` ﹒`1h` ﹒`2d`\n\n' +
          '✩ m — minutitos\n' +
          '✩ h — horitas\n' +
          '✩ d — días',
      );
      return;
    }

    const reason = cleanArgs.slice(1).join(' ') || 'No reason provided';

    await ctx.react('⏳');

    try {
      const isMuted = await serviceManager.moderationService.isMuted(ctx.chat.jid, mentionedJid);

      if (isMuted) {
        await ctx.reply('This user is already muted');
        return;
      }

      await serviceManager.moderationService.muteUser(
        ctx.chat.jid,
        mentionedJid,
        targetUser.name,
        ctx.sender.pushName || 'Unknown',
        reason,
        duration,
      );

      const durationText = this.formatDuration(duration);

      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *en silencio* ˚₊· ͟͟͞͞➳\n\n` +
          `✩ *quién:* ${targetUser.name}\n` +
          `✩ *por cuánto:* ${durationText}\n` +
          `✩ *por qué:* ${reason}\n` +
          `✩ *por:* ${ctx.sender.pushName}\n` +
          `✩ *cuándo:* ${new Date().toLocaleString()}`,
      );

      await ctx.react('✅');
    } catch (error: unknown) {
      logError('[MuteCommand] Error', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      await ctx.reply(`❌ Error mutting user: ${message}`);
      await ctx.react('❌');
    }
  }

  private parseDuration(str: string): number | null {
    const match = str.match(/^(\d+)([mhd])$/);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return null;
    }
  }

  private formatDuration(ms: number): string {
    const minutes = Math.floor(ms / (60 * 1000));
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));

    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
}
