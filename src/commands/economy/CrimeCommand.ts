import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { formatNumber } from '@/utils/helpers.js';

const crimeCooldowns = new Map<string, number>();
const CRIME_COOLDOWN = 3 * 60 * 1000;

export class CrimeCommand extends Command {
  name = 'crime';
  description = 'Roba dinero (con riesgo)';
  category = CommandCategory.ECONOMY;
  aliases = ['robar', 'steal'];
  usage = '!crime';
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
        `🚨 *EN ENSAYO*\n\n` +
          `Debes esperar *${remaining} minutos*\n` +
          `antes de volver a robar.`,
      );
      return;
    }

    const crime = this.CRIMES[Math.floor(Math.random() * this.CRIMES.length)];
    const success = Math.random() < crime.success;

    if (success) {
      const earned = Math.floor(Math.random() * (crime.max - crime.min + 1)) + crime.min;

      await serviceManager.userService.addMoney(ctx.sender.jid, earned);

      crimeCooldowns.set(ctx.sender.jid, now);

      const user = await serviceManager.userService.getUser(ctx.sender.jid);

      await ctx.reply(
        `🚨 *ROBO EXITOSO* 🚨\n\n` +
          `${crime.emoji} *${crime.name.toUpperCase()}*\n\n` +
          `✨ *GANASTE!*\n` +
          `💰 +$${formatNumber(earned)}\n\n` +
          `📊 Éxito: ${Math.round(crime.success * 100)}%\n\n` +
          `💵 Balance: $${formatNumber(user.money)}`,
      );
      await ctx.react('🎉');
    } else {
      const user = await serviceManager.userService.getUser(ctx.sender.jid);

      crimeCooldowns.set(ctx.sender.jid, now);

      await ctx.reply(
        `🚨 *ROBO FALLIDO* 🚨\n\n` +
          `${crime.emoji} *${crime.name.toUpperCase()}*\n\n` +
          `💔 *Te atraparon!*\n` +
          `No ganaste nada...\n\n` +
          `📊 Éxito: ${Math.round(crime.success * 100)}%\n\n` +
          `💵 Balance: $${formatNumber(user.money)}\n\n` +
          `⏰ Intenta de nuevo en 3 minutos`,
      );
      await ctx.react('🚨');
    }
  }
}
