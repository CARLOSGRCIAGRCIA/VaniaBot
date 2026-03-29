import { Middleware } from './Middleware.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { middlewareCache } from './MiddlewareCache.js';

export class VaniaToggleMiddleware extends Middleware {
  name = 'vania-toggle';

  async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    if (!ctx.chat.isGroup) {
      await next();
      return;
    }

    if (['vaniaon', 'vaniaoff', 'vaniastatus'].includes(ctx.command)) {
      await next();
      return;
    }

    const cacheKey = ctx.chat.jid;
    let cached = middlewareCache.groupEnabled.get<{ value: boolean }>(cacheKey);

    if (cached === undefined) {
      try {
        const isEnabled = await serviceManager.vaniaToggleService.isEnabled(ctx.chat.jid);
        cached = { value: isEnabled };
        middlewareCache.groupEnabled.set(cacheKey, cached);
      } catch {
        await next();
        return;
      }
    }

    if (!cached.value) {
      return;
    }

    await next();
  }
}
