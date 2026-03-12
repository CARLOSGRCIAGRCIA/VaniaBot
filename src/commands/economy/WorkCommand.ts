import { Command } from '../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { formatNumber } from '@/utils/helpers.js';

export class WorkCommand extends Command {
  name = 'work';
  description = 'Work to earn money';
  category = CommandCategory.ECONOMY;
  aliases = ['work'];
  usage = '!work';
  cooldown = 60 * 60 * 1000;

  private readonly JOBS = [
    { name: 'Programmer', min: 500, max: 1500, emoji: '💻' },
    { name: 'Chef', min: 300, max: 1000, emoji: '👨‍🍳' },
    { name: 'Driver', min: 200, max: 800, emoji: '🚗' },
    { name: 'Teacher', min: 400, max: 1200, emoji: '👨‍🏫' },
    { name: 'Musician', min: 250, max: 900, emoji: '🎸' },
  ];

  async execute(ctx: MessageContext): Promise<void> {
    const job = this.JOBS[Math.floor(Math.random() * this.JOBS.length)];
    const earned = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;

    await serviceManager.userService.addMoney(ctx.sender.jid, earned);

    const xpGained = Math.floor(earned / 10);
    await serviceManager.levelService.addXP(ctx.sender.jid, xpGained);

    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    await ctx.reply(
      `${job.emoji} *WORK COMPLETED*\n\n` +
        `You worked as: ${job.name}\n` +
        `💰 Earned: $${formatNumber(earned)}\n` +
        `⚡ XP: +${xpGained}\n\n` +
        `💵 Balance: $${formatNumber(user.money)}`,
    );
  }
}
