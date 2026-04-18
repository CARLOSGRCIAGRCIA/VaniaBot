import { Middleware } from './Middleware.js';
import type { MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { middlewareCache } from './MiddlewareCache.js';
import { PermissionService } from '@/services/PermissionService.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

export class MuteMiddleware extends Middleware {
  name = 'mute';

  async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    if (!ctx.chat.isGroup) {
      await next();
      return;
    }

    await ctx.loadBotPermissions();

    const cacheKey = `${ctx.chat.jid}:${ctx.sender.jid}`;
    const cached = middlewareCache.userMuted.get<{ value: boolean }>(cacheKey);

    try {
      if (cached?.value === true) {
        if (ctx.chat.isBotAdmin) {
          try {
            await ctx.sock.sendMessage(ctx.chat.jid, {
              delete: ctx.message.key,
            });
          } catch (error) {
            logError('[MUTE] Error al eliminar mensaje', error);
          }
        }

        return;
      }
    } catch (error) {
      logError('[MUTE ERROR]', error);
    }

    await next();
  }

  private async notifyAdmins(ctx: MessageContext): Promise<void> {
    try {
      const admins = await PermissionService.getGroupAdmins(ctx.sock, ctx.chat.jid);
      const botJid = ctx.sock.user?.id;

      const adminJids = admins.filter(admin => admin !== botJid);

      if (adminJids.length === 0) {
        return;
      }

      const muteInfo = await serviceManager.moderationService.getMuteInfo(
        ctx.chat.jid,
        ctx.sender.jid,
      );
      const timeRemaining = await serviceManager.moderationService.getMuteTimeRemaining(
        ctx.chat.jid,
        ctx.sender.jid,
      );

      const timeText = this.formatTimeRemaining(timeRemaining);

      for (const adminJid of adminJids) {
        try {
          await ctx.sock.sendMessage(adminJid, {
            text:
              `🔇 *Aviso de Mute*\n\n` +
              `El usuario *${ctx.sender.pushName || 'Desconocido'}* está muteado pero intentó enviar un mensaje.\n\n` +
              `📝 Razón: ${muteInfo?.reason || 'No especificada'}\n` +
              `⏱️ Tiempo restante: ${timeText}\n` +
              `💬 Mensaje: ${ctx.text.slice(0, 100)}${ctx.text.length > 100 ? '...' : ''}\n\n` +
              `⚠️ El bot necesita ser admin para eliminar automáticamente los mensajes muteados.`,
          });
        } catch {
        }
      }
    } catch (error) {
      logError('[MUTE] Error notifyAdmins', error);
    }
  }

  private formatTimeRemaining(ms: number): string {
    if (ms <= 0) return 'Expira inmediatamente';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} día${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hora${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `${minutes} minuto${minutes > 1 ? 's' : ''}`;
    return `${seconds} segundo${seconds > 1 ? 's' : ''}`;
  }
}
