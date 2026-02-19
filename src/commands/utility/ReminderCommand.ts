import { Command } from "../Command.js";
import {
  CommandCategory,
  CommandContext,
  type MessageContext,
} from "@/types/index.js";

interface Reminder {
  id: string;
  userJid: string;
  chatJid: string;
  message: string;
  triggerAt: number;
  createdAt: number;
}

const reminders = new Map<string, Reminder>();
const reminderTimers = new Map<string, NodeJS.Timeout>();

let globalSock: any = null;

export class ReminderCommand extends Command {
  name = "recordatorio";
  description = "Programa recordatorios y alarmas personales.";
  category = CommandCategory.UTILITY;
  aliases = ["remind", "alarma", "recordar", "timer"];
  usage = "!recordatorio <tiempo> <mensaje>";
  examples = [
    "!recordatorio 10m Revisar el horno",
    "!recordatorio 2h Llamar al doctor",
    "!recordatorio 1d Pagar la renta",
    "!recordatorio lista",
    "!recordatorio cancelar <id>",
  ];
  cooldown = 2000;
  contexts = [CommandContext.BOTH];

  private readonly MAX_REMINDERS_PER_USER = 5;

  private parseTime(input: string): number | null {
    const regex = /^(\d+)(s|seg|m|min|h|hr|d|dia|dias)$/i;
    const match = input.match(regex);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers: Record<string, number> = {
      s: 1000,
      seg: 1000,
      m: 60 * 1000,
      min: 60 * 1000,
      h: 60 * 60 * 1000,
      hr: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      dia: 24 * 60 * 60 * 1000,
      dias: 24 * 60 * 60 * 1000,
    };

    return value * (multipliers[unit] || 0);
  }

  private formatTimeLeft(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
  }

  private scheduleReminder(reminder: Reminder, sock: any): void {
    const delay = reminder.triggerAt - Date.now();
    if (delay <= 0) return;

    const timer = setTimeout(async () => {
      try {
        await sock.sendMessage(reminder.chatJid, {
          text:
            `⏰ *¡Recordatorio!*\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `📝 ${reminder.message}\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `👤 @${reminder.userJid.split("@")[0]}`,
          mentions: [reminder.userJid],
        });
      } catch (_) {}
      reminders.delete(reminder.id);
      reminderTimers.delete(reminder.id);
    }, delay);

    reminderTimers.set(reminder.id, timer);
  }

  async execute(ctx: MessageContext): Promise<void> {
    if (!globalSock) globalSock = ctx.sock;

    const sub = ctx.args[0]?.toLowerCase();

    if (sub === "lista" || sub === "list") {
      const userReminders = [...reminders.values()].filter(
        (r) => r.userJid === ctx.sender.jid,
      );

      if (!userReminders.length) {
        await ctx.reply("📭 No tienes recordatorios activos.");
        return;
      }

      const lines = userReminders.map((r) => {
        const left = this.formatTimeLeft(r.triggerAt - Date.now());
        return `🔔 *[${r.id}]* — ${r.message}\n   ⏳ En: ${left}`;
      });

      await ctx.reply(
        `⏰ *Tus recordatorios activos*\n` +
          `━━━━━━━━━━━━━━━━\n` +
          lines.join("\n\n") +
          `\n━━━━━━━━━━━━━━━━\n` +
          `Para cancelar: !recordatorio cancelar <ID>`,
      );
      return;
    }

    if (sub === "cancelar" || sub === "cancel") {
      const id = ctx.args[1]?.toUpperCase();
      if (!id) {
        await ctx.reply("❌ Uso: !recordatorio cancelar <ID>");
        return;
      }

      const reminder = reminders.get(id);
      if (!reminder) {
        await ctx.reply(`❌ Recordatorio *${id}* no encontrado.`);
        return;
      }

      if (reminder.userJid !== ctx.sender.jid && !ctx.sender.isOwner) {
        await ctx.reply("❌ Solo puedes cancelar tus propios recordatorios.");
        return;
      }

      const timer = reminderTimers.get(id);
      if (timer) clearTimeout(timer);
      reminders.delete(id);
      reminderTimers.delete(id);

      await ctx.reply(`✅ Recordatorio *[${id}]* cancelado.`);
      return;
    }

    if (ctx.args.length < 2) {
      await ctx.reply(
        `⏰ *Recordatorios*\n\n` +
          `*Uso:* !recordatorio <tiempo> <mensaje>\n\n` +
          `*Tiempos:*\n` +
          `  30s → 30 segundos\n` +
          `  10m → 10 minutos\n` +
          `  2h  → 2 horas\n` +
          `  1d  → 1 día\n\n` +
          `*Subcomandos:*\n` +
          `  !recordatorio lista\n` +
          `  !recordatorio cancelar <ID>`,
      );
      return;
    }

    const timeStr = ctx.args[0];
    const messageText = ctx.args.slice(1).join(" ");

    const delayMs = this.parseTime(timeStr);
    if (!delayMs || delayMs <= 0) {
      await ctx.reply(
        `❌ Tiempo inválido: *${timeStr}*\n` +
          `Ejemplos válidos: 30s, 10m, 2h, 1d`,
      );
      return;
    }

    const maxMs = 7 * 24 * 60 * 60 * 1000;
    if (delayMs > maxMs) {
      await ctx.reply("❌ El tiempo máximo para un recordatorio es *7 días*.");
      return;
    }

    const userReminders = [...reminders.values()].filter(
      (r) => r.userJid === ctx.sender.jid,
    );
    if (userReminders.length >= this.MAX_REMINDERS_PER_USER) {
      await ctx.reply(
        `❌ Límite alcanzado (máx. ${this.MAX_REMINDERS_PER_USER} recordatorios).\n` +
          `Cancela uno con: !recordatorio cancelar <ID>`,
      );
      return;
    }

    const id = this.generateId();
    const triggerAt = Date.now() + delayMs;

    const reminder: Reminder = {
      id,
      userJid: ctx.sender.jid,
      chatJid: ctx.chat.jid,
      message: messageText,
      triggerAt,
      createdAt: Date.now(),
    };

    reminders.set(id, reminder);
    this.scheduleReminder(reminder, ctx.sock);

    await ctx.react("✅");
    await ctx.reply(
      `⏰ *Recordatorio programado*\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `🆔 ID: *${id}*\n` +
        `📝 Mensaje: ${messageText}\n` +
        `⏳ En: *${this.formatTimeLeft(delayMs)}*\n` +
        `🕐 A las: ${new Date(triggerAt).toLocaleTimeString("es-MX")}\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `Para cancelar: !recordatorio cancelar ${id}`,
    );
  }
}
