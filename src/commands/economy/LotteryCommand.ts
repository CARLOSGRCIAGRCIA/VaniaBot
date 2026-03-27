import { Command } from '../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { lotteryService } from '@/services/economy/LotteryService.js';

export class LotteryCommand extends Command {
  name = 'loteria';
  description = 'Compra un ticket de lotería y participa en el sorteo';
  category = CommandCategory.ECONOMY;
  aliases = ['loteria', 'lottery', 'loto'];
  usage = '!loteria [numero]';
  examples = ['!loteria', '!loteria 42'];
  cooldown = 10000;

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args;
    let number: number | undefined;

    if (args.length > 0) {
      number = parseInt(args[0]);
      if (isNaN(number) || number < 1 || number > 99) {
        await ctx.reply('❌ El número debe estar entre 1 y 99');
        return;
      }
    }

    const result = await lotteryService.buyTicket(ctx.sender.jid, number);

    if (!result.success) {
      await ctx.reply(result.message);
      await ctx.react('❌');
      return;
    }

    await ctx.reply(result.message);
    await ctx.react('🎫');
  }
}
