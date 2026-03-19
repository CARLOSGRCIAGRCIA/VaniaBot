import { Middleware } from './Middleware.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

export class VaniaToggleMiddleware extends Middleware {
  name = 'vania-toggle';

  async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    if (!ctx.chat.isGroup) {
      await next();
      return;
    }

    if (ctx.command === 'vaniaon') {
      await next();
      return;
    }

    try {
      const isEnabled = await serviceManager.vaniaToggleService.isEnabled(ctx.chat.jid);

      if (!isEnabled) {
        return;
      }
    } catch {
      // Si hay error, permitir continuar
    }

    await next();
  }
}
