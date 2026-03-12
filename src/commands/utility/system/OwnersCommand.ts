import { Command } from "../../Command.js";
import { CommandCategory } from "@/types/index.js";
import type { MessageContext } from "@/types/index.js";
import { config } from "@/config/index.js";
import { serviceManager } from "@/services/system/Servicemanager.js";

export class OwnersCommand extends Command {
  name = "owners";
  description = "Muestra la lista de owners del bot";
  category = CommandCategory.UTILITY;
  aliases = ["propietarios", "dueños", "admins"];
  usage = "!owners";
  examples = ["!owners"];

  async execute(ctx: MessageContext): Promise<void> {
    try {
      const allUsers = await serviceManager.userService.getAllUsers();
      const owners = allUsers.filter((u) => u.isOwner);

      if (owners.length === 0) {
        await ctx.reply("⚠️ No hay owners registrados");
        return;
      }

      let ownersList = "";
      owners.forEach((owner, index) => {
        ownersList += `${index + 1}. 👑 ${owner.name}\n`;
      });

      const message = `
┏━━━━━━━━━━━━━━
┃ 👑 *OWNERS DEL BOT*
┣━━━━━━━━━━━━━━
┃
${ownersList}┃
┃ Total: ${owners.length}
┗━━━━━━━━━━━━━━
      `.trim();

      await ctx.reply(message);
    } catch (error) {
      console.error("Error en OwnersCommand:", error);
      await ctx.reply("❌ Error al obtener owners");
    }
  }
}
