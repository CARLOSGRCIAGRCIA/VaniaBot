import { serviceManager } from '../system/Servicemanager.js';

export interface RobberyAttempt {
  attackerJid: string;
  victimJid: string;
  amount: number;
  success: boolean;
  timestamp: number;
}

export interface RobberyCooldown {
  lastAttempt: number;
  failedAttempts: number;
}

const ROBBERY_CONFIG = {
  baseCooldown: 5 * 60 * 1000,
  maxCooldown: 30 * 60 * 1000,
  minRobberyAmount: 1000,
  maxRobberyPercent: 0.3,
  finePercent: 0.5,
  maxFine: 50000,
  protectionItemId: 'insurance_policy',
  safeZones: ['bank', 'vault'],
};

const ROBBERY_TIERS = [
  {
    name: 'carterista',
    minAmount: 1000,
    maxAmount: 5000,
    successRate: 0.65,
    fine: 2000,
    emoji: '👜',
  },
  {
    name: 'ladrón callejero',
    minAmount: 5000,
    maxAmount: 15000,
    successRate: 0.5,
    fine: 8000,
    emoji: '🦹',
  },
  {
    name: 'asaltante',
    minAmount: 15000,
    maxAmount: 40000,
    successRate: 0.4,
    fine: 20000,
    emoji: '🔫',
  },
  {
    name: 'hacker',
    minAmount: 40000,
    maxAmount: 100000,
    successRate: 0.3,
    fine: 50000,
    emoji: '💻',
  },
  {
    name: 'mafioso',
    minAmount: 100000,
    maxAmount: 300000,
    successRate: 0.2,
    fine: 100000,
    emoji: '👔',
  },
];

export class RobberyService {
  private static instance: RobberyService;
  private cooldowns = new Map<string, RobberyCooldown>();
  private recentRobberies: RobberyAttempt[] = [];

  static getInstance(): RobberyService {
    if (!RobberyService.instance) {
      RobberyService.instance = new RobberyService();
    }
    return RobberyService.instance;
  }

  getCooldown(jid: string): { remaining: number; level: string } {
    const cooldown = this.cooldowns.get(jid);
    if (!cooldown) return { remaining: 0, level: 'none' };

    const elapsed = Date.now() - cooldown.lastAttempt;
    const baseTime = ROBBERY_CONFIG.baseCooldown * Math.pow(1.5, cooldown.failedAttempts);
    const maxTime = Math.min(baseTime, ROBBERY_CONFIG.maxCooldown);
    const remaining = Math.max(0, maxTime - elapsed);

    let level = 'none';
    if (remaining > 20 * 60 * 1000) level = 'max';
    else if (remaining > 10 * 60 * 1000) level = 'high';
    else if (remaining > 5 * 60 * 1000) level = 'medium';

    return { remaining, level };
  }

  async attemptRobbery(
    attackerJid: string,
    victimJid: string,
    tierIndex?: number,
  ): Promise<{
    success: boolean;
    message: string;
    amount?: number;
    fine?: number;
  }> {
    const attacker = await serviceManager.userService.getUser(attackerJid);
    const victim = await serviceManager.userService.getUser(victimJid);

    if (attackerJid === victimJid) {
      return { success: false, message: '❌ No puedes robártele a ti mismo' };
    }

    if (attacker.isOwner) {
      return { success: false, message: '❌ Los owners no pueden robar' };
    }

    if (victim.isOwner) {
      return { success: false, message: '❌ No puedes robar a un owner' };
    }

    if (victim.isBanned) {
      return { success: false, message: '❌ El usuario está baneado' };
    }

    const cooldown = this.getCooldown(attackerJid);
    if (cooldown.remaining > 0) {
      const minutes = Math.ceil(cooldown.remaining / 60000);
      return {
        success: false,
        message:
          `🚨 *EN COOLDOWN*\n\n` +
          `Debes esperar *${minutes} minutos*\n` +
          `antes de robar de nuevo.\n\n` +
          `💡 *Tip:* El cooldown aumenta\n` +
          `con cada intento fallido.`,
      };
    }

    const victimMoney = victim.money;
    const victimBank = victim.bank || 0;
    const totalVictimMoney = victimMoney + victimBank;

    if (totalVictimMoney < ROBBERY_CONFIG.minRobberyAmount) {
      return {
        success: false,
        message:
          `💔 *Víctima sin dinero*\n\n` +
          `La víctima no tiene suficiente\n` +
          `dinero para robar. Mínimo: $${ROBBERY_CONFIG.minRobberyAmount.toLocaleString()}`,
      };
    }

    const tier =
      tierIndex !== undefined
        ? ROBBERY_TIERS[tierIndex]
        : ROBBERY_TIERS[Math.floor(Math.random() * ROBBERY_TIERS.length)];

    const canAffordFine = attacker.money >= tier.fine;
    const actualFine = canAffordFine ? tier.fine : attacker.money;

    const maxSteal = Math.min(
      Math.floor(victimMoney * ROBBERY_CONFIG.maxRobberyPercent),
      tier.maxAmount,
    );

    if (maxSteal < tier.minAmount) {
      return {
        success: false,
        message: `❌ La víctima no tiene suficiente\n` + `efectivo para este tipo de robo.`,
      };
    }

    const stealAmount =
      Math.floor(Math.random() * (maxSteal - tier.minAmount + 1)) + tier.minAmount;
    const success = Math.random() < tier.successRate;

    const attackerCooldown = this.cooldowns.get(attackerJid) || {
      lastAttempt: 0,
      failedAttempts: 0,
    };

    if (success) {
      const actualSteal = Math.min(stealAmount, victimMoney);

      await serviceManager.userService.removeMoney(victimJid, actualSteal);
      await serviceManager.userService.addMoney(attackerJid, actualSteal);

      attackerCooldown.lastAttempt = Date.now();
      attackerCooldown.failedAttempts = 0;
      this.cooldowns.set(attackerJid, attackerCooldown);

      this.recentRobberies.push({
        attackerJid,
        victimJid,
        amount: actualSteal,
        success: true,
        timestamp: Date.now(),
      });

      return {
        success: true,
        message:
          `🚨 *ROBO EXITOSO* 🚨\n\n` +
          `${tier.emoji} *${tier.name.toUpperCase()}*\n\n` +
          `🎯 *Víctima:* ${victim.name}\n` +
          `💰 *Robado:* $${actualSteal.toLocaleString()}\n\n` +
          `📊 Probabilidad: ${Math.round(tier.successRate * 100)}%\n` +
          `⏰ Cooldown: 5 minutos`,
        amount: actualSteal,
      };
    } else {
      if (attacker.money > 0) {
        await serviceManager.userService.removeMoney(attackerJid, actualFine);
      }

      attackerCooldown.lastAttempt = Date.now();
      attackerCooldown.failedAttempts++;
      this.cooldowns.set(attackerJid, attackerCooldown);

      const newCooldown = this.getCooldown(attackerJid);
      const waitMinutes = Math.ceil(newCooldown.remaining / 60000);

      this.recentRobberies.push({
        attackerJid,
        victimJid,
        amount: actualFine,
        success: false,
        timestamp: Date.now(),
      });

      return {
        success: false,
        message:
          `🚨 *ROBO FALLIDO* 🚨\n\n` +
          `${tier.emoji} *${tier.name.toUpperCase()}*\n\n` +
          `💔 *Te atraparon!*\n` +
          `💰 *Multa:* $${actualFine.toLocaleString()}\n\n` +
          `📊 Probabilidad: ${Math.round(tier.successRate * 100)}%\n` +
          `⏰ Espera: ${waitMinutes} minutos\n\n` +
          `💡 *Tip:* Guarda dinero en el banco\n` +
          `con !deposit para protegerlo`,
        fine: actualFine,
      };
    }
  }

  getRobberyTiers(): {
    name: string;
    minAmount: number;
    maxAmount: number;
    successRate: number;
    fine: number;
    emoji: string;
  }[] {
    return ROBBERY_TIERS;
  }

  getRecentRobberies(): RobberyAttempt[] {
    return this.recentRobberies.filter(r => Date.now() - r.timestamp < 24 * 60 * 60 * 1000);
  }
}

export const robberyService = RobberyService.getInstance();
