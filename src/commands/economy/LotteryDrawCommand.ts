import { Command } from '../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { lotteryService } from '@/services/economy/LotteryService.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

export class LotteryDrawCommand extends Command {
  name = 'sorteoloteria';
  description = 'Realiza el sorteo de la lotería (min 5 tickets)';
  category = CommandCategory.ECONOMY;
  aliases = ['sorteoloteria', 'drawlottery'];
  usage = '!sorteoloteria';
  examples = ['!sorteoloteria'];

  async execute(ctx: MessageContext): Promise<void> {
    const sender = await serviceManager.userService.getUser(ctx.sender.jid);

    if (!sender.isOwner) {
      await ctx.reply('❌ Solo el owner puede usar este comando');
      await ctx.react('❌');
      return;
    }

    const result = await lotteryService.draw();

    if (!result.success) {
      await ctx.reply(result.message);
      return;
    }

    await ctx.reply(result.message);
    await ctx.react('🎰');
  }
}
