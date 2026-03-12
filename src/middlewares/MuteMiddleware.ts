import { Middleware } from "./Middleware.js";
import type { MessageContext } from "@/types/index.js";
import { serviceManager } from "@/services/system/Servicemanager.js";
import { logError, logger } from "@/utils/logger.js";

export class MuteMiddleware extends Middleware {
  name = "mute";

  async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    if (!ctx.chat.isGroup) {
      await next();
      return;
    }

    try {
      const isMuted = await serviceManager.moderationService.isMuted(
        ctx.chat.jid,
        ctx.sender.jid,
      );

      if (isMuted) {
        await ctx.loadBotPermissions();

        if (ctx.chat.isBotAdmin) {
          logger.info(
            `[MUTE] Intentando borrar mensaje: ${ctx.message.key.id}`,
          );
          await ctx.sock.sendMessage(ctx.chat.jid, {
            delete: ctx.message.key,
          });
        } else {
          logger.warn(`[MUTE] Bot no es admin, no puede borrar mensaje`);
        }
        return;
      }
    } catch (error) {
      logError("[MUTE ERROR]", error);
    }

    await next();
  }
}
