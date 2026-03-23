import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

export class BalanceCommand extends Command {
  name = 'balance';
  description = "Check your or someone else's balance";
  category = CommandCategory.ECONOMY;
  aliases = ['bal', 'money', 'cash', 'dinero'];
  usage = '!balance [@user]';
  examples = ['!balance', '!balance @user', '!bal'];
  cooldown = 3000;
  parallelizable = true;

  async execute(ctx: MessageContext): Promise<void> {
    const mentionedJid = ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    const targetJid = mentionedJid || ctx.sender.jid;
    const targetUser = await serviceManager.userService.getUser(targetJid);

    const isSelf = targetJid === ctx.sender.jid;
    const isOwner = targetUser.isOwner;

    let message = '';

    if (isSelf) {
      message = `💰 *Your Balance*\n\n`;
    } else {
      message = `💰 *${targetUser.name}'s Balance*\n\n`;
    }

    message += `💵 Money: $${targetUser.money.toLocaleString()}`;

    if (isOwner) {
      message += ` ♾️\n`;
      message += `\n👑 *Owner Status:* Unlimited funds`;
    } else {
      message += `\n`;
    }

    const allUsers = await serviceManager.userService.getAllUsers();
    const sortedByMoney = allUsers.filter(u => !u.isOwner).sort((a, b) => b.money - a.money);

    const rank = sortedByMoney.findIndex(u => u.jid === targetJid) + 1;

    if (rank > 0) {
      message += `📊 Rank: #${rank} of ${sortedByMoney.length}`;
    }

    const canClaimDaily = serviceManager.userService.canClaimDaily(targetUser);

    message += `\n\n💎 *Daily Reward:* ${canClaimDaily ? '✅ Available' : '⏳ Claimed'}`;

    if (!canClaimDaily && isSelf) {
      const remaining = serviceManager.userService.getDailyTimeRemaining(targetUser);
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

      message += `\n⏰ Next: ${hours}h ${minutes}m`;
    }

    message += `\n\n> _*VaniaBot💝*_`;

    await ctx.reply(message);
  }
}
