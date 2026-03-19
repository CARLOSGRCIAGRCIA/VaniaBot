import { Middleware } from './Middleware.js';
import type { MessageContext, ICommand } from '@/types/index.js';
import type { CommandRegistry } from '@/core/CommandRegistry.js';
import { CommandContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';

export class ValidationMiddleware extends Middleware {
  name = 'validation';

  constructor(private registry: CommandRegistry) {
    super();
  }

  async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    const command = this.registry.get(ctx.command);

    if (!command) {
      await next();
      return;
    }

    if (!this.validateContext(command, ctx)) {
      const contextName = ctx.chat.isGroup ? 'grupos' : 'chats privados';
      const replyPromise = ctx.reply(`❌ Este comando solo funciona en ${contextName}`);
      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('ValidationMiddleware.reply timeout')), 10000),
      );
      try {
        await Promise.race([replyPromise, timeoutPromise]);
      } catch (error) {
        logError('ValidationMiddleware.reply', error);
      }
      return;
    }

    await next();
  }

  private validateContext(command: ICommand, ctx: MessageContext): boolean {
    if (!command.contexts || command.contexts.includes(CommandContext.BOTH)) return true;

    if (command.contexts.includes(CommandContext.GROUP) && !ctx.chat.isGroup) return false;

    if (command.contexts.includes(CommandContext.PRIVATE) && ctx.chat.isGroup) return false;

    return true;
  }
}
