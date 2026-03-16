import { Command } from '../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { formatNumber } from '@/utils/helpers.js';
import { validateBetAmount } from '@/utils/validators.js';
import { config } from '@/config/index.js';

export class CoinflipCommand extends Command {
  name = 'coinflip';
  description = 'Bet on a coin flip (heads or tails)';
  category = CommandCategory.GAME;
  aliases = ['cf'];
  usage = '!coinflip <heads|tails> <amount>';
  examples = ['!cf heads 500', '!coinflip tails 1000'];
  cooldown = 5000;

  async execute(ctx: MessageContext): Promise<void> {
    const rawChoice = ctx.args[0]?.toLowerCase();
    const amountStr = ctx.args[1];

    let userChoice: 'heads' | 'tails' | null = null;
    if (['heads', 'head', 'h'].includes(rawChoice)) {
      userChoice = 'heads';
    } else if (['tails', 'tail', 't'].includes(rawChoice)) {
      userChoice = 'tails';
    }

    if (!userChoice) {
      await ctx.reply(`Invalid choice. Please select heads or tails.\n\n` + `Usage: ${this.usage}`);
      return;
    }

    const amount = parseInt(amountStr);
    if (!amountStr || isNaN(amount) || amount <= 0) {
      await ctx.reply(`Invalid amount.\n\n` + `Usage: ${this.usage}`);
      return;
    }

    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    if (!user.isOwner) {
      const validation = validateBetAmount(amount, user.money, {
        minBet: config.economy.minBet,
        maxBet: config.economy.maxBet,
      });

      if (!validation.valid) {
        await ctx.reply(validation.error || '❌ Apuesta inválida');
        return;
      }
    }

    const result: 'heads' | 'tails' = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = result === userChoice;

    if (won) {
      await serviceManager.userService.addMoney(ctx.sender.jid, amount);
    } else {
      await serviceManager.userService.removeMoney(ctx.sender.jid, amount);
    }

    const updatedUser = await serviceManager.userService.getUser(ctx.sender.jid);

    const status = won ? 'YOU WON!' : 'You lost.';
    const change = won ? `+$${formatNumber(amount)}` : `-$${formatNumber(amount)}`;

    await ctx.reply(
      `*COIN FLIP*\n\n` +
        `You chose: **${userChoice.toUpperCase()}**\n` +
        `Result: **${result.toUpperCase()}**\n\n` +
        `**${status}**\n` +
        `${change}\n\n` +
        `Balance: $${formatNumber(updatedUser.money)}`,
    );
  }
}
