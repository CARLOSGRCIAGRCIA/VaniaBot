import type { MessageContext } from '@/core/MessageContext.js';
import type { IMiddleware } from '@/types/index.js';
import { logger } from '@/utils/logger.js';

export class SubBotOwnerBlockMiddleware implements IMiddleware {
  name = 'SubBotOwnerBlock';
  priority = 0;
  canRunParallel = true;

  private readonly BLOCKED_COMMANDS = [
    'addbot',
    'delbot',
    'serbot',
    'listbot',
    'subbot',
    'subbots',
    'subboton',
    'subbotoff',
    'owner',
    'eval',
    'exec',
  ];

  async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    if (ctx.botId === 'main') {
      return next();
    }

    const command = ctx.command?.toLowerCase();
    if (this.BLOCKED_COMMANDS.includes(command)) {
      logger.debug(`SubBotOwnerBlock: blocked "${command}" from subbot ${ctx.botId}`);
      return;
    }

    return next();
  }
}
