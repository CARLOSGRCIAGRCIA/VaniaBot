import { Middleware } from './Middleware.js';
import type { MessageContext } from '@/types/index.js';
import { chatSummaryService } from '@/services/chat/ChatSummaryService.js';
import { config } from '@/config/index.js';

export class ChatSummaryMiddleware extends Middleware {
  name = 'chatsummary';

  async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    if (!ctx.chat.isGroup) {
      await next();
      return;
    }

    const text = ctx.text;
    if (typeof text !== 'string' || text.length < 2) {
      await next();
      return;
    }

    const prefixes = Array.isArray(config.prefix) ? config.prefix : [config.prefix];
    if (prefixes.some(p => text.startsWith(p))) {
      await next();
      return;
    }

    const sender = ctx.sender.pushName || 'User';
    chatSummaryService.addMessage(ctx.chat.jid, sender, text);

    await next();
  }
}
