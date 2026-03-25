import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { formatNumber } from '@/utils/helpers.js';

const crimeCooldowns = new Map<string, number>();
const CRIME_COOLDOWN = 3 * 60 * 1000;

export class CrimeCommand extends Command {
  name = 'crime';
  description = 'Roba a un usuario mencionado';
  category = CommandCategory.ECONOMY;
  aliases = ['robar', 'steal'];
  usage = '!crime @user';
  examples = ['!crime @usuario'];
  cooldown = 180000;

  private readonly CRIMES = [
    { name: 'carterista', min: 500, max: 2000, emoji: '👜', success: 0.6 },
    { name: 'asaltante', min: 2000, max: 5000, emoji: '🔫', success: 0.45 },
    { name: 'hacker', min: 5000, max: 15000, emoji: '💻', success: 0.35 },
    { name: 'secuestrador', min: 15000, max: 30000, emoji: '👺', success: 0.25 },
    { name: 'cartel', min: 30000, max: 100000, emoji: '💊', success: 0.15 },
  ];

  async execute(ctx: MessageContext): Promise<void> {
    const now = Date.now();
    const lastCrime = crimeCooldowns.get(ctx.sender.jid);

    if (lastCrime && now - lastCrime < CRIME_COOLDOWN) {
      const remaining = Math.ceil((CRIME_COOLDOWN - (now - lastCrime)) / 60000);
      await ctx.reply(
        `🚨 *EN COOLDOWN*\n\n` +
          `Debes esperar *${remaining} minutos*\n` +
          `antes de volver a robar.`,
      );
      return;
    }

    const mentionedJid = ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (!mentionedJid) {
      await ctx.reply(
        `🚨 *ROBAR* 🚨\n\n` +
          `✿ *Cómo usar:*\n` +
          `!crime @usuario\n\n` +
          `📊 *Información:*\n` +
          `• Los owners no pueden ser robados\n` +
          `• El dinero en el banco está seguro\n` +
          `• Cooldown: 3 minutos\n\n` +
          `📝 *Ejemplo:*\n` +
          `!crime @usuario`,
      );
      return;
    }

    const attacker = await serviceManager.userService.getUser(ctx.sender.jid);
    const victim = await serviceManager.userService.getUser(mentionedJid);

    if (attacker.jid === mentionedJid) {
      await ctx.reply(`❌ No puedes robarte a ti mismo`);
      return;
    }

    if (victim.isOwner) {
      await ctx.reply(
        `🚨 *PROTEGIDO*\n\n` +
          `❌ No puedes robar a un *OWNER*\n\n` +
          `🛡️ Los owners están protegidos`,
      );
      return;
    }

    if (victim.isBanned) {
      await ctx.reply(`❌ El usuario está baneado`);
      return;
    }

    const crime = this.CRIMES[Math.floor(Math.random() * this.CRIMES.length)];
    const success = Math.random() < crime.success;

    const victimMoney = victim.money;
    const victimBank = victim.bank || 0;

    if (success && victimMoney > 0) {
      const maxSteal = Math.min(crime.max, victimMoney);
      const earned = Math.floor(Math.random() * (maxSteal - crime.min + 1)) + crime.min;
      const actualSteal = Math.min(earned, victimMoney);

      await serviceManager.userService.removeMoney(mentionedJid, actualSteal);
      await serviceManager.userService.addMoney(ctx.sender.jid, actualSteal);

      crimeCooldowns.set(ctx.sender.jid, now);

      await ctx.reply(
        `🚨 *ROBO EXITOSO* 🚨\n\n` +
          `${crime.emoji} *${crime.name.toUpperCase()}*\n\n` +
          `🎯 *Robaste a:* ${victim.name}\n` +
          `✨ *GANASTE!*\n` +
          `💰 +$${formatNumber(actualSteal)}\n\n` +
          `📊 Éxito: ${Math.round(crime.success * 100)}%\n\n` +
          `💵 Tu balance: $${formatNumber((await serviceManager.userService.getUser(ctx.sender.jid)).money)}`,
      );
      await ctx.react('🎉');
    } else {
      crimeCooldowns.set(ctx.sender.jid, now);

      let msg = `🚨 *ROBO FALLIDO* 🚨\n\n`;
      msg += `${crime.emoji} *${crime.name.toUpperCase()}*\n\n`;

      if (victimMoney <= 0 && victimBank <= 0) {
        msg += `💔 *La víctima no tiene dinero*\n`;
        msg += `(Todo está en el banco)\n\n`;
      } else {
        msg += `💔 *Te atraparon!*\n\n`;
      }

      msg += `📊 Éxito: ${Math.round(crime.success * 100)}%\n\n`;
      msg += `💡 *Tip:* Guarda dinero en el banco con !deposit`;

      await ctx.reply(msg);
      await ctx.react('🚨');
    }
  }
}
