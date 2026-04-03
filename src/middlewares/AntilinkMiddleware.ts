import { Middleware } from './Middleware.js';
import type { MessageContext } from '@/types/index.js';
import { antilinkService } from '@/services/moderation/AntilinkService.js';
import { logger } from '@/utils/logger.js';

export class AntilinkMiddleware extends Middleware {
  name = 'antilink';

  private getSenderJid(ctx: MessageContext): string | null {
    return ctx.message.key.participant ?? null;
  }

  async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    if (!ctx.chat.isGroup) {
      await next();
      return;
    }

    if (!antilinkService.isEnabled(ctx.chat.jid)) {
      await next();
      return;
    }

    if (ctx.sender.isOwner || ctx.sender.isAdmin) {
      await next();
      return;
    }

    const text = ctx.text;

    if (typeof text !== 'string' || !text) {
      await next();
      return;
    }

    const checkResult = antilinkService.getBlockedLinkInfo(ctx.chat.jid, text);

    if (checkResult.blocked && checkResult.link) {
      try {
        if (checkResult.action === 'delete') {
          await ctx.sock.sendMessage(ctx.chat.jid, { delete: ctx.message.key });
          await ctx.reply(`Enlace bloqueado: *${checkResult.link.domain || checkResult.link.raw}*`);
        } else if (checkResult.action === 'kick' && ctx.chat.isBotAdmin) {
          const senderJid = this.getSenderJid(ctx);
          if (senderJid) {
            await ctx.sock.groupParticipantsUpdate(ctx.chat.jid, [senderJid], 'remove');
            await ctx.reply(
              `Enlace bloqueado: *${checkResult.link.domain || checkResult.link.raw}*\nExpulsado automáticamente.`,
            );
          } else {
            await ctx.sock.sendMessage(ctx.chat.jid, { delete: ctx.message.key });
            await ctx.reply(
              `Enlace bloqueado: *${checkResult.link.domain || checkResult.link.raw}*`,
            );
          }
        } else {
          await ctx.sock.sendMessage(ctx.chat.jid, { delete: ctx.message.key });
          await ctx.reply(`Enlace bloqueado: *${checkResult.link.domain || checkResult.link.raw}*`);
        }
        return;
      } catch (error) {
        logger.error('AntilinkMiddleware: Error procesando mensaje', error);
      }
    }

    await next();
  }
}
