import { Middleware } from './Middleware.js';
import type { MessageContext } from '@/types/index.js';
import { antiArabService } from '@/services/moderation/AntiArabService.js';
import { logError, logger } from '@/utils/logger.js';

export class AntiArabMiddleware extends Middleware {
  name = 'antiarab';

  async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    if (!ctx.chat.isGroup) {
      await next();
      return;
    }

    if (!antiArabService.isEnabled(ctx.chat.jid)) {
      await next();
      return;
    }

    if (ctx.sender.isOwner || ctx.sender.isAdmin) {
      await next();
      return;
    }

    await next();
  }

  async onGroupParticipantUpdate(
    sock: MessageContext['sock'],
    update: {
      id: string;
      action: string;
      participants?: string[];
    },
  ): Promise<void> {
    if (update.action !== 'add') return;
    if (!antiArabService.isEnabled(update.id)) return;

    for (const participant of update.participants || []) {
      const number = this.extractNumber(participant);
      if (!number) continue;

      if (this.isOwnerOrWhitelisted(number, sock)) continue;

      if (antiArabService.shouldBlockNumber(number)) {
        try {
          await sock.groupParticipantsUpdate(update.id, [participant], 'remove');
          logger.info(`AntiArab: Usuario ${number} removido del grupo ${update.id}`);
        } catch (error) {
          logger.error(`AntiArab: Error al remover usuario ${number}`, error);
        }
      }
    }
  }

  private extractNumber(jid: string): string {
    return jid.replace(/@.*$/, '').replace(/[^\d]/g, '');
  }

  private isOwnerOrWhitelisted(number: string, sock: MessageContext['sock']): boolean {
    try {
      const botNumber = (sock?.user?.id || '').replace(/@.*$/, '').replace(/[^\d]/g, '');
      return number === botNumber;
    } catch (error) {
      logError('[AntiArab]', error);
      return false;
    }
  }
}
