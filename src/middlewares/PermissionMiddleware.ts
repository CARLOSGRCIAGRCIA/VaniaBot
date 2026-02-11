import { Middleware } from "./Middleware.js";
import type { MessageContext } from "@/types/index.js";
import { CommandRegistry } from "@/core/CommandRegistry.js";
import { PermissionLevel, BotPermission } from "@/types/index.js";

export class PermissionMiddleware extends Middleware {
  name = "permission";

  constructor(private registry: CommandRegistry) {
    super();
  }

  async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    const command = this.registry.get(ctx.command);

    if (!command) {
      await next();
      return;
    }

    if (!this.checkUserPermissions(command, ctx)) {
      await ctx.reply("❌ No tienes permisos para usar este comando");
      return;
    }

    if (ctx.chat.isGroup && !this.checkBotPermissions(command, ctx)) {
      await ctx.reply(
        "❌ El bot necesita ser administrador para ejecutar este comando",
      );
      return;
    }

    await next();
  }

  private checkUserPermissions(command: any, ctx: MessageContext): boolean {
    const requiredPerms = command.permissions?.user || [PermissionLevel.USER];

    if (ctx.sender.isOwner) {
      return true;
    }

    if (requiredPerms.includes(PermissionLevel.OWNER)) {
      return ctx.sender.isOwner;
    }

    if (requiredPerms.includes(PermissionLevel.ADMIN)) {
      return ctx.sender.isAdmin || ctx.sender.isOwner;
    }

    return true;
  }

  private checkBotPermissions(command: any, ctx: MessageContext): boolean {
    const requiredPerms = command.permissions?.bot || [];

    if (requiredPerms.length === 0) {
      return true;
    }

    if (requiredPerms.includes(BotPermission.ADMIN)) {
      return ctx.chat.isBotAdmin;
    }

    return true;
  }
}
