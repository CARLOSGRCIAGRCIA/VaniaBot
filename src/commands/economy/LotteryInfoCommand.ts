import { Command } from '../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { lotteryService } from '@/services/economy/LotteryService.js';

export class LotteryInfoCommand extends Command {
  name = 'loteriainfo';
  description = 'Ver información de la lotería actual';
  category = CommandCategory.ECONOMY;
  aliases = ['loteriainfo', 'lotto', 'lottoinfo'];
  usage = '!loteriainfo';
  examples = ['!loteriainfo'];

  async execute(ctx: MessageContext): Promise<void> {
    const info = lotteryService.getTicketsInfo();
    const myTicket = lotteryService.getUserTicket(ctx.sender.jid);

    let message = `🎰 *LOTERÍA VANIA*\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🎫 *Tickets vendidos:* ${info.total}/100\n`;
    message += `💰 *Precio:* $${info.ticketPrice.toLocaleString()}\n`;
    message += `🏆 *Jackpot:* $${info.jackpot.toLocaleString()}\n\n`;

    if (info.total < 5) {
      message += `⚠️ *Se necesitan 5 tickets para sortear*\n\n`;
    } else {
      message += `✅ *Listo para sortear!*\n`;
      message += `Usa *.sorteoloteria* para dibujar\n\n`;
    }

    if (myTicket) {
      message += `🎫 *Tu ticket:* #${myTicket.number.toString().padStart(2, '0')}`;
    } else {
      message += `❌ *No tienes ticket*\n`;
      message += `Compra uno con *.loteria*`;
    }

    await ctx.reply(message);
  }
}
