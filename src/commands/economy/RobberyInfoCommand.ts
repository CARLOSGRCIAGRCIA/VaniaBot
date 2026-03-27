import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { robberyService } from '@/services/economy/RobberyService.js';

export class RobberyInfoCommand extends Command {
  name = 'robinfo';
  description = 'Ver información de robbing y cooldown';
  category = CommandCategory.ECONOMY;
  aliases = ['robinfo', 'roboinfo'];
  usage = '!robinfo';
  examples = ['!robinfo'];

  async execute(ctx: MessageContext): Promise<void> {
    const cooldown = robberyService.getCooldown(ctx.sender.jid);
    const tiers = robberyService.getRobberyTiers();

    let message = `🚨 *INFO DE ROBO* 🚨\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (cooldown.remaining > 0) {
      const minutes = Math.ceil(cooldown.remaining / 60000);
      message += `⏰ *COOLDOWN ACTIVO*\n`;
      message += `Tiempo restante: *${minutes} minutos*\n\n`;
    } else {
      message += `✅ *LISTO PARA ROBAR*\n\n`;
    }

    message += `📊 *TIPOS DE ROBO*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;

    for (const tier of tiers) {
      message += `\n${tier.emoji} *${tier.name}*\n`;
      message += `   💰 Rango: $${tier.minAmount.toLocaleString()}-${tier.maxAmount.toLocaleString()}\n`;
      message += `   📈 Éxito: ${Math.round(tier.successRate * 100)}%\n`;
      message += `   💸 Multa: $${tier.fine.toLocaleString()}\n`;
    }

    message += `\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `💡 *Tips:*\n`;
    message += `• Solo robas efectivo (no banco)\n`;
    message += `• Multa si te atrapan\n`;
    message += `• Cooldown aumenta con fallos\n`;
    message += `• @menciona para robar a alguien específico`;

    await ctx.reply(message);
  }
}
