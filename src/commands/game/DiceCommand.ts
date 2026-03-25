import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { formatNumber } from '@/utils/helpers.js';
import { validateBetAmount } from '@/utils/validators.js';
import { config } from '@/config/index.js';

export class DiceCommand extends Command {
  name = 'dice';
  description = 'Juega a los dados';
  category = CommandCategory.GAME;
  aliases = ['dados', 'dado'];
  usage = '!dice <1-6> <cantidad>';
  examples = ['!dice 6 500', '!dados 3 100'];
  cooldown = 3000;
  parallelizable = true;

  async execute(ctx: MessageContext): Promise<void> {
    const choiceStr = ctx.args[0];
    const amountStr = ctx.args[1];
    const choice = parseInt(choiceStr);
    const amount = parseInt(amountStr);

    if (!choiceStr || isNaN(choice) || choice < 1 || choice > 6) {
      await ctx.reply(
        `🎲 *DADOS* 🎲\n\n` +
          `✿ *Cómo jugar:*\n` +
          `!dice <número> <cantidad>\n\n` +
          `📊 *Multiplicador:* 6x\n\n` +
          `💰 Límites: $${config.economy.minBet} - $${config.economy.maxBet.toLocaleString()}\n\n` +
          `📝 *Ejemplo:*\n` +
          `!dice 6 500`,
      );
      return;
    }

    if (!amountStr || isNaN(amount) || amount <= 0) {
      await ctx.reply('❌ Cantidad inválida');
      return;
    }

    const user = await serviceManager.userService.getUser(ctx.sender.jid);
    const totalBalance = await serviceManager.userService.getTotalBalance(ctx.sender.jid);

    if (!user.isOwner) {
      const validation = validateBetAmount(amount, totalBalance, {
        minBet: config.economy.minBet,
        maxBet: config.economy.maxBet,
      });

      if (!validation.valid) {
        await ctx.reply(validation.error || '❌ No tienes suficiente dinero');
        return;
      }
    }

    let usedBank = false;
    if (!user.isOwner && user.money < amount) {
      const deficit = amount - user.money;
      await serviceManager.userService.removeBank(ctx.sender.jid, deficit);
      await serviceManager.userService.addMoney(ctx.sender.jid, user.money);
      usedBank = true;
    }

    const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    const rolled = Math.floor(Math.random() * 6) + 1;
    const won = rolled === choice;
    const multiplier = 6;
    const winAmount = won ? Math.floor(amount * multiplier) : 0;
    const profit = winAmount - amount;

    if (!user.isOwner) {
      if (profit > 0) {
        await serviceManager.userService.addMoney(ctx.sender.jid, profit);
      } else {
        await serviceManager.userService.removeMoney(ctx.sender.jid, amount);
      }
    }

    const updatedUser = await serviceManager.userService.getUser(ctx.sender.jid);

    let message = `🎲 *DADOS* 🎲\n\n`;
    message += `🎯 *Elegiste:* ${choice} ${diceEmojis[choice - 1]}\n`;
    message += `🎲 *Salió:* ${rolled} ${diceEmojis[rolled - 1]}\n\n`;

    if (won) {
      message += `✨ *GANASTE!*\n`;
      message += `💰 Apostaste: $${amount.toLocaleString()}\n`;
      message += `🎉 Ganaste: $${winAmount.toLocaleString()}\n`;
      message += `📈 Profit: +$${profit.toLocaleString()}`;
    } else {
      message += `💔 *PERDISTE*\n`;
      message += `💰 Perdiste: $${amount.toLocaleString()}`;
    }

    if (!user.isOwner) {
      message += `\n\n💵 Balance: $${updatedUser.money.toLocaleString()}`;
    }

    await ctx.reply(message);
    await ctx.react(won ? '🎉' : '💔');
  }
}
