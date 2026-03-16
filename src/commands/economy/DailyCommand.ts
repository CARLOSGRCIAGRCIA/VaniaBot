import { Command } from '../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { formatNumber, formatTime } from '@/utils/helpers.js';
import { errorHandler } from '@/utils/ErrorHandler.js';

export class DailyCommand extends Command {
  name = 'daily';
  description = 'Claim your daily reward';
  category = CommandCategory.ECONOMY;
  aliases = ['daily'];
  usage = '!daily';
  cooldown = 1000;

  async execute(ctx: MessageContext): Promise<void> {
    try {
      const user = await serviceManager.userService.getUser(ctx.sender.jid);

      if (!this.canClaim(user.lastDaily)) {
        const remaining = this.getTimeRemaining(user.lastDaily);
        await ctx.reply(
          `You have already claimed your daily reward.\n\n` +
            `Available again in: ${formatTime(remaining)}`,
        );
        return;
      }

      const streak = this.calculateStreak(user.lastDaily);
      const baseReward = 1000;
      const streakBonus = Math.min(streak * 100, 1000);
      const totalReward = baseReward + streakBonus;

      await serviceManager.userService.addMoney(ctx.sender.jid, totalReward);
      await serviceManager.userService.updateUser(ctx.sender.jid, {
        lastDaily: Date.now(),
      });

      await serviceManager.levelService.addXP(ctx.sender.jid, 50);

      const updatedUser = await serviceManager.userService.getUser(ctx.sender.jid);

      await ctx.reply(
        `*DAILY REWARD*\n\n` +
          `+$${formatNumber(totalReward)}\n` +
          `Streak: ${streak} days\n` +
          `+50 XP\n\n` +
          `Balance: $${formatNumber(updatedUser.money)}`,
      );
    } catch (error) {
      const message = errorHandler.handleCommandError(error, 'daily', {
        userId: ctx.sender.jid,
        groupId: ctx.chat.isGroup ? ctx.chat.jid : undefined,
      });
      await ctx.reply(message).catch(() => {});
    }
  }

  private canClaim(lastDaily?: number): boolean {
    if (!lastDaily) return true;
    const oneDayMs = 24 * 60 * 60 * 1000;
    return Date.now() - lastDaily >= oneDayMs;
  }

  private getTimeRemaining(lastDaily?: number): number {
    if (!lastDaily) return 0;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const remaining = lastDaily + oneDayMs - Date.now();
    return Math.max(0, remaining);
  }

  private calculateStreak(lastDaily?: number): number {
    if (!lastDaily) return 1;

    const daysSince = Math.floor((Date.now() - lastDaily) / (24 * 60 * 60 * 1000));

    if (daysSince > 2) return 1;

    if (daysSince === 1) return 2;

    return 1;
  }
}
