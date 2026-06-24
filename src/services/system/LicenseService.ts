import type { GroupService } from '@/services/database/GroupService.js';
import { logger } from '@/utils/logger.js';

export type PlanType = 'permanent' | 'monthly';
export type PaymentType = 'single' | 'subscription';
export type BotId = 'main' | `subbot_${number}`;

export interface LicenseInfo {
  planType: PlanType;
  paymentType: PaymentType;
  activatedAt: number;
  expiresAt: number | null;
  renewAt: number | null;
  lastRenewAt: number | null;
  autoRenew: boolean;
  pricePaid: string;
}

export class LicenseService {
  private static instance: LicenseService;
  private groupService!: GroupService;
  private licenseCache = new Map<string, { valid: boolean; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000;
  private readonly EXPIRY_WARNING_DAYS = 7;

  private constructor() {}

  static getInstance(): LicenseService {
    if (!LicenseService.instance) {
      LicenseService.instance = new LicenseService();
    }
    return LicenseService.instance;
  }

  setGroupService(groupService: GroupService): void {
    this.groupService = groupService;
  }

  private isExpired(license: LicenseInfo): boolean {
    if (license.planType === 'permanent') return false;
    if (!license.expiresAt) return true;
    return Date.now() > license.expiresAt;
  }

  private getDaysRemaining(license: LicenseInfo): number {
    if (license.planType === 'permanent') return -1;
    if (!license.expiresAt) return 0;
    return Math.max(0, Math.floor((license.expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
  }

  async activateLicense(
    groupJid: string,
    planType: PlanType,
    paymentType: PaymentType,
    pricePaid: string,
    months: number = 1,
  ): Promise<boolean> {
    try {
      const _group = await this.groupService.getGroup(groupJid);
      const now = Date.now();
      const monthMs = 30 * 24 * 60 * 60 * 1000;

      const newLicense: LicenseInfo = {
        planType,
        paymentType,
        activatedAt: now,
        expiresAt: planType === 'monthly' ? now + months * monthMs : null,
        renewAt: planType === 'monthly' ? now + months * monthMs : null,
        lastRenewAt: null,
        autoRenew: false,
        pricePaid,
      };

      await this.groupService.updateGroup(groupJid, {
        license: newLicense,
        isActive: true,
      });

      this.licenseCache.set(groupJid, { valid: true, timestamp: Date.now() });
      logger.info(`[License] Activada para ${groupJid}: ${planType} - $${pricePaid}`);
      return true;
    } catch (error) {
      logger.error('[License] Error activando licencia:', error);
      return false;
    }
  }

  async renewLicense(groupJid: string, months: number = 1, pricePaid?: string): Promise<boolean> {
    try {
      const group = await this.groupService.getGroup(groupJid);
      if (group.license.planType !== 'monthly') {
        logger.warn(`[License] No se puede renovar licencia permanente: ${groupJid}`);
        return false;
      }

      const now = Date.now();
      const monthMs = 30 * 24 * 60 * 60 * 1000;
      const currentExpires = group.license.expiresAt || now;
      const newExpires =
        currentExpires < now ? now + months * monthMs : currentExpires + months * monthMs;

      const updatedLicense: LicenseInfo = {
        ...group.license,
        expiresAt: newExpires,
        renewAt: newExpires,
        lastRenewAt: now,
        pricePaid: pricePaid || group.license.pricePaid,
      };

      await this.groupService.updateGroup(groupJid, { license: updatedLicense });
      this.licenseCache.set(groupJid, { valid: true, timestamp: Date.now() });
      logger.info(`[License] Renovada para ${groupJid}: +${months} mes(es)`);
      return true;
    } catch (error) {
      logger.error('[License] Error renovando:', error);
      return false;
    }
  }

  async cancelLicense(groupJid: string): Promise<boolean> {
    try {
      await this.groupService.updateGroup(groupJid, { isActive: false });
      this.licenseCache.set(groupJid, { valid: false, timestamp: Date.now() });
      logger.info(`[License] Cancelada para ${groupJid}`);
      return true;
    } catch (error) {
      logger.error('[License] Error cancelando:', error);
      return false;
    }
  }

  async isLicenseValid(groupJid: string): Promise<boolean> {
    const cached = this.licenseCache.get(groupJid);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.valid;
    }

    try {
      const group = await this.groupService.getGroup(groupJid);
      const isValid = group.isActive && !this.isExpired(group.license);
      this.licenseCache.set(groupJid, { valid: isValid, timestamp: Date.now() });
      return isValid;
    } catch {
      return false;
    }
  }

  async getLicenseInfo(groupJid: string): Promise<string> {
    try {
      const group = await this.groupService.getGroup(groupJid);
      const lic = group.license;

      const plan = lic.planType === 'permanent' ? '💎 Permanente' : '📅 Mensual';
      const status = this.isExpired(lic)
        ? '❌ VENCIDA'
        : lic.planType === 'permanent'
          ? '✅ Activa'
          : `⏳ ${this.getDaysRemaining(lic)} días restantes`;

      let info = `*Plan:* ${plan}\n*Estado:* ${status}\n*Precio:* $${lic.pricePaid}`;

      if (lic.planType === 'monthly' && lic.lastRenewAt) {
        info += `\n*Última renovación:* ${new Date(lic.lastRenewAt).toLocaleDateString('es-MX')}`;
      }

      return info;
    } catch {
      return '❌ Error al obtener información';
    }
  }

  async checkExpiringLicenses(): Promise<{ groupJid: string; daysRemaining: number }[]> {
    const expiring: { groupJid: string; daysRemaining: number }[] = [];

    try {
      const groups = await this.groupService.getAllGroups();
      for (const group of groups) {
        if (!group.license || group.license.planType === 'permanent') continue;
        const days = this.getDaysRemaining(group.license);
        if (days > 0 && days <= this.EXPIRY_WARNING_DAYS) {
          expiring.push({ groupJid: group.jid, daysRemaining: days });
        }
      }
    } catch (error) {
      logger.error('[License] Error verificando licencias por vencer:', error);
    }

    return expiring;
  }

  async disableExpiredLicenses(): Promise<number> {
    let disabled = 0;
    try {
      const groups = await this.groupService.getAllGroups();
      const expiredGroups = groups.filter(
        group => group.isActive && group.license && this.isExpired(group.license),
      );
      await Promise.all(
        expiredGroups.map(group =>
          this.groupService.updateGroup(group.jid, { isActive: false }).then(() => {
            this.licenseCache.set(group.jid, { valid: false, timestamp: Date.now() });
            logger.info(`[License] Deshabilitada licencia vencida: ${group.jid}`);
            disabled++;
          }),
        ),
      );
    } catch (error) {
      logger.error('[License] Error deshabilitando vencidas:', error);
    }
    return disabled;
  }

  getPlanPrices(): {
    monthly: { 1: number; 3: number; 5: number };
    permanent: { 1: number; 3: number; 5: number };
  } {
    return {
      monthly: { 1: 60, 3: 150, 5: 250 },
      permanent: { 1: 100, 3: 250, 5: 400 },
    };
  }

  formatPricingTable(): string {
    const prices = this.getPlanPrices();
    const usdRate = 20;

    let table = `*💎 LICENCIA PERMANENTE*\n`;
    table += `▸ 1 bot  — $${prices.permanent[1]} MXN / $${Math.round(prices.permanent[1] / usdRate)} USD\n`;
    table += `▸ 3 bots — $${prices.permanent[3]} MXN / $${Math.round(prices.permanent[3] / usdRate)} USD\n`;
    table += `▸ 5 bots — $${prices.permanent[5]} MXN / $${Math.round(prices.permanent[5] / usdRate)} USD ⭐\n\n`;

    table += `*📅 PLAN MENSUAL*\n`;
    table += `▸ 1 bot  — $${prices.monthly[1]} MXN / $${Math.round(prices.monthly[1] / usdRate)} USD\n`;
    table += `▸ 3 bots — $${prices.monthly[3]} MXN / $${Math.round(prices.monthly[3] / usdRate)} USD\n`;
    table += `▸ 5 bots — $${prices.monthly[5]} MXN / $${Math.round(prices.monthly[5] / usdRate)} USD ⭐`;

    return table;
  }
}

export const licenseService = LicenseService.getInstance();
