import type { WASocket } from '@whiskeysockets/baileys';
import { logger } from '@/utils/logger.js';
import { extractPhone } from './JidService.js';

interface LidPhoneCache {
  get(jid: string): string | undefined;
  set(jid: string, phone: string): void;
  delete(jid: string): void;
  clear(): void;
}

export class LidResolver {
  private static lidPhoneCache: LidPhoneCache = new Map<string, string>();

  static async resolve(sock: WASocket, lidJid: string): Promise<string | null> {
    const cached = this.lidPhoneCache.get(lidJid);
    if (cached) return cached;

    try {
      const onWhatsApp = (
        sock as unknown as { onWhatsApp?: (jid: string) => Promise<Array<{ jid?: string }>> }
      ).onWhatsApp;
      if (!onWhatsApp) return null;

      const result = await onWhatsApp.call(sock, lidJid);
      logger.debug(`[LID RESOLVE] ${lidJid} →`, JSON.stringify(result));

      if (result && result[0]?.jid) {
        const phone = extractPhone(result[0].jid);
        this.lidPhoneCache.set(lidJid, phone);
        return phone;
      }
    } catch (err) {
      logger.debug(`[LID RESOLVE ERROR] ${lidJid}:`, err);
    }
    return null;
  }

  static clearCache(): void {
    this.lidPhoneCache.clear();
  }

  static invalidate(jid: string): void {
    this.lidPhoneCache.delete(jid);
  }
}
