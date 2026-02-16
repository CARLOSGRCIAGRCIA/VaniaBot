import { Command } from "../Command.js";
import { CommandCategory, PermissionLevel } from "@/types/index.js";
import type { MessageContext } from "@/types/index.js";
import { serviceManager } from "@/services/Servicemanager.js";

export class SetOwnerCommand extends Command {
  name = "setowner";
  description = "Establece o remueve permisos de owner a un usuario";
  category = CommandCategory.OWNER;
  aliases = ["makeowner", "removeowner", "owner"];
  usage = "!setowner <add|remove> <@usuario>";
  examples = [
    "!setowner add @5215551234567",
    "!setowner remove @5215551234567",
  ];
  permissions = {
    user: [PermissionLevel.OWNER],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args;

    if (args.length < 2) {
      await ctx.reply(
        `❌ Uso incorrecto\n\n📖 Uso: ${this.usage}\n\n📝 Ejemplos:\n${this.examples.join("\n")}`,
      );
      return;
    }

    const action = args[0].toLowerCase();
    const mentionedJid =
      ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (!mentionedJid) {
      await ctx.reply("❌ Debes mencionar a un usuario");
      return;
    }

    if (mentionedJid === ctx.sender.jid) {
      await ctx.reply("❌ No puedes modificar tus propios permisos de owner");
      return;
    }

    try {
      const targetUser = await serviceManager.userService.getUser(mentionedJid);

      switch (action) {
        case "add":
        case "agregar":
        case "dar":
          if (targetUser.isOwner) {
            await ctx.reply(`⚠️ ${targetUser.name} ya es owner`);
            return;
          }

          await serviceManager.userService.setOwner(mentionedJid, true);
          await ctx.reply(
            `✅ ${targetUser.name} ahora es owner\n\n👑 Privilegios concedidos:\n• Permisos ilimitados\n• Recursos infinitos\n• Bypass de restricciones`,
          );
          break;

        case "remove":
        case "remover":
        case "quitar":
          if (!targetUser.isOwner) {
            await ctx.reply(`⚠️ ${targetUser.name} no es owner`);
            return;
          }

          await serviceManager.userService.setOwner(mentionedJid, false);
          await ctx.reply(
            `✅ Permisos de owner removidos de ${targetUser.name}`,
          );
          break;

        default:
          await ctx.reply("❌ Acción inválida. Usa: add o remove");
      }
    } catch (error) {
      console.error("Error en SetOwnerCommand:", error);
      await ctx.reply(
        `❌ Error: ${error instanceof Error ? error.message : "Desconocido"}`,
      );
    }
  }
}
