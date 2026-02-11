import { Middleware } from "./Middleware.js";
import type { MessageContext } from "@/types/index.js";
import { serviceManager } from "@/services/Servicemanager.js";

interface UserMessageTracker {
  messages: number[];
  warnings: number;
}

export class AntiSpamMiddleware extends Middleware {
  name = "anti-spam";

  private userMessages = new Map<string, UserMessageTracker>();
  private readonly CLEANUP_INTERVAL = 60000;

  constructor() {
    super();

    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
  }

  async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    if (!ctx.chat.isGroup) {
      await next();
      return;
    }

    const groupSettings = await serviceManager.groupService.getGroup(
      ctx.chat.jid,
    );

    if (!groupSettings.antiSpam.enabled) {
      await next();
      return;
    }

    const key = `${ctx.chat.jid}:${ctx.sender.jid}`;
    const now = Date.now();
    const timeWindow = groupSettings.antiSpam.timeWindow * 1000;
    const maxMessages = groupSettings.antiSpam.maxMessages;

    let tracker = this.userMessages.get(key);
    if (!tracker) {
      tracker = { messages: [], warnings: 0 };
      this.userMessages.set(key, tracker);
    }

    tracker.messages = tracker.messages.filter(
      (time) => now - time < timeWindow,
    );

    tracker.messages.push(now);

    if (tracker.messages.length > maxMessages) {
      tracker.warnings++;

      if (tracker.warnings === 1) {
        await ctx.reply("⚠️ *Advertencia:* No hagas spam");
        return;
      }

      if (tracker.warnings === 2) {
        await ctx.reply(
          "⚠️ *Última advertencia:* Deja de hacer spam o serás expulsado",
        );
        return;
      }

      if (tracker.warnings >= 3 && ctx.chat.isBotAdmin) {
        try {
          await ctx.sock.groupParticipantsUpdate(
            ctx.chat.jid,
            [ctx.sender.jid],
            "remove",
          );

          await ctx.sendMessage({
            text: `❌ ${ctx.sender.pushName} fue expulsado por spam`,
          });

          this.userMessages.delete(key);

          return;
        } catch (error) {
          await ctx.reply("❌ No pude expulsar al usuario (falta permisos)");
        }
      }

      if (tracker.warnings >= 3) {
        await ctx.reply(
          "❌ Spam detectado. Serías expulsado si el bot fuera administrador.",
        );
        return;
      }
    }

    await next();
  }

  private cleanup(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000;

    for (const [key, tracker] of this.userMessages.entries()) {
      if (
        tracker.messages.length === 0 ||
        tracker.messages.every((time) => now - time > maxAge)
      ) {
        this.userMessages.delete(key);
      }
    }
  }
}
