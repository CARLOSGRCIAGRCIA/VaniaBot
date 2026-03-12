import { Command } from "../../Command.js";
import { CommandCategory, CommandContext } from "@/types/index.js";
import type { MessageContext } from "@/types/index.js";

export class AllCommand extends Command {
  name = "all";
  description = "Mention all group members with an optional message";
  category = CommandCategory.UTILITY;
  aliases = ["everyone", "tagall"];
  usage = "!all [message]";
  examples = ["!all", "!all Hello everyone!"];
  contexts = [CommandContext.GROUP];
  cooldown = 30000;

  async execute(ctx: MessageContext): Promise<void> {
    try {
      const groupMetadata = await ctx.sock.groupMetadata(ctx.chat.jid);
      const participants = groupMetadata.participants;

      if (participants.length === 0) {
        await ctx.reply("No hay miembros en el grupo~");
        return;
      }

      const customMessage = ctx.args.join(" ").trim();
      const admins = participants.filter((p) => p.admin);
      const members = participants.filter((p) => !p.admin);
      const total = participants.length;

      let text = `¡Hola a todos! ✨\n\n`;
      text += `Mencionando a los ${total} integrantes del grupo 💕\n\n`;

      if (customMessage) {
        text += `*Mensaje:*\n`;
        text += `${customMessage}\n\n`;
      }

      text += `*Admins* (${admins.length}) 👑\n`;
      if (admins.length === 0) {
        text += `- No hay admins\n`;
      } else {
        admins.forEach((p) => {
          const num = p.id.split("@")[0];
          text += `🌸 @${num}\n`;
        });
      }

      text += `\n`;

      text += `*Miembros* (${members.length}) 🌸\n`;
      if (members.length === 0) {
        text += `- No hay miembros\n`;
      } else {
        members.forEach((p) => {
          const num = p.id.split("@")[0];
          text += `🌸 @${num}\n`;
        });
      }

      text += `\nGracias por estar aquí ~ ❤️`;
      text += `\n> _*I'm VaniaBot*_ ❤️`;

      const mentions = participants.map((p) => p.id);

      await ctx.sock.sendMessage(
        ctx.chat.jid,
        {
          text: text.trim(),
          mentions: mentions,
        },
        { quoted: ctx.message },
      );
    } catch (error) {
      console.error("Error in AllCommand:", error);
      await ctx.reply(
        "Ocurrió un error al mencionar a los miembros, lo siento~",
      );
    }
  }
}
