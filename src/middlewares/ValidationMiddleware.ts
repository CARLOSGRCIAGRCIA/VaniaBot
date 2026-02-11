import { Middleware } from "./Middleware.js";
import type { MessageContext } from "@/types/index.js";
import { CommandRegistry } from "@/core/CommandRegistry.js";
import { CommandContext } from "@/types/index.js";

export class ValidationMiddleware extends Middleware {
  name = "validation";

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
      const contextName = ctx.chat.isGroup ? "grupos" : "chats privados";
      await ctx.reply(`❌ Este comando solo funciona en ${contextName}`);
      return;
    }

    await next();
  }

  private validateContext(command: any, ctx: MessageContext): boolean {
    if (!command.contexts || command.contexts.includes(CommandContext.BOTH)) {
      return true;
    }

    if (command.contexts.includes(CommandContext.GROUP) && !ctx.chat.isGroup) {
      return false;
    }

    if (command.contexts.includes(CommandContext.PRIVATE) && ctx.chat.isGroup) {
      return false;
    }

    return true;
  }
}
