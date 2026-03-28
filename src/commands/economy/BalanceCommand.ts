import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

export class BalanceCommand extends Command {
  name = 'balance';
  description = "Check your or someone else's balance";
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
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

    const bankBalance = targetUser.bank || 0;
    const totalBalance = targetUser.money + bankBalance;

    let message = '';

    if (isSelf) {
      message = `💰 *TU BALANCE*\n\n`;
    } else {
      message = `💰 *${targetUser.name}'s Balance*\n\n`;
    }

    if (isOwner) {
      message += `💵 Cash: ∞ ♾️\n`;
      message += `🏦 Banco: ∞ ♾️\n`;
      message += `📊 Total: ∞ ♾️\n\n`;
      message += `👑 *Dueño:* Fondos ilimitados`;
    } else {
      message += `💵 Efectivo: $${targetUser.money.toLocaleString()}\n`;
      message += `🏦 Banco: $${bankBalance.toLocaleString()}\n`;
      message += `📊 Total: $${totalBalance.toLocaleString()}\n`;
    }

    const allUsers = await serviceManager.userService.getAllUsers();
    const sortedByMoney = allUsers
      .filter(u => !u.isOwner)
      .map(u => ({ ...u, total: u.money + (u.bank || 0) }))
      .sort((a, b) => b.total - a.total);

    const rank = sortedByMoney.findIndex(u => u.jid === targetJid) + 1;

    if (rank > 0) {
      message += `\n📊 Rank: #${rank} de ${sortedByMoney.length}`;
    }

    const canClaimDaily = serviceManager.userService.canClaimDaily(targetUser);

    message += `\n\n💎 *Daily:* ${canClaimDaily ? '✅ Disponible' : '⏳ Ya reclamado'}`;

    if (!canClaimDaily && isSelf) {
      const remaining = serviceManager.userService.getDailyTimeRemaining(targetUser);
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

      message += `\n⏰ Próximo: ${hours}h ${minutes}m`;
    }

    if (!isOwner && bankBalance > 0) {
      message += `\n\n🛡️ *Dinero protegido en banco*`;
    }

    message += `\n\n> _*VaniaBot💝*_`;

    await ctx.reply(message);
  }
}
