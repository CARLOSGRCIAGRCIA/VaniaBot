import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

export class RankingCommand extends Command {
  name = 'ranking';
  description = 'Ver ranking de usuarios';
  category = CommandCategory.ECONOMY;
  aliases = ['top', 'rank', 'leaderboard'];
  usage = '!ranking [money|xp|level]';
  examples = ['!ranking', '!top xp'];
  cooldown = 10000;

  async execute(ctx: MessageContext): Promise<void> {
    const type = ctx.args[0]?.toLowerCase() || 'money';

    const allUsers = await serviceManager.userService.getAllUsers();
    const nonOwners = allUsers.filter(u => !u.isOwner);

    let sorted: typeof nonOwners;
    let title: string;

    switch (type) {
      case 'xp':
      case 'experience':
        sorted = [...nonOwners].sort((a, b) => b.xp - a.xp);
        title = '🏆 *TOP XP*';
        break;
      case 'level':
      case 'nivel':
        sorted = [...nonOwners].sort((a, b) => b.level - a.level);
        title = '⭐ *TOP NIVEL*';
        break;
      case 'money':
      default:
        sorted = [...nonOwners].sort((a, b) => b.money - a.money);
        title = '💰 *TOP DINERO*';
        break;
    }

    const userRank = sorted.findIndex(u => u.jid === ctx.sender.jid) + 1;

    let message = `${title}\n\n`;

    const top10 = sorted.slice(0, 10);
    top10.forEach((user, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;

      switch (type) {
        case 'xp':
        case 'experience':
          message += `${medal} *${user.name}*\n`;
          message += `   XP: ${user.xp.toLocaleString()} | Nivel: ${user.level}\n\n`;
          break;
        case 'level':
        case 'nivel':
          message += `${medal} *${user.name}*\n`;
          message += `   Nivel: ${user.level} | XP: ${user.xp.toLocaleString()}\n\n`;
          break;
        default:
          message += `${medal} *${user.name}*\n`;
          message += `   $${user.money.toLocaleString()}\n\n`;
      }
    });

    if (userRank > 0) {
      const user = sorted[userRank - 1];
      message += `━━━━━━━\n`;
      message += `📊 *Tu posición:* #${userRank}\n`;

      switch (type) {
        case 'xp':
        case 'experience':
          message += `   XP: ${user.xp.toLocaleString()}\n`;
          break;
        case 'level':
        case 'nivel':
          message += `   Nivel: ${user.level}\n`;
          break;
        default:
          message += `   $${user.money.toLocaleString()}\n`;
      }
    }

    message += `\n> _*VaniaBot💝*_`;

    await ctx.reply(message);
  }
}
