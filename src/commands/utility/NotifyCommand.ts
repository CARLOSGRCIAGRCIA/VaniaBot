import { Command } from "../Command.js";
import { CommandCategory, CommandContext } from "@/types/index.js";
import type { MessageContext } from "@/types/index.js";

export class NotifyCommand extends Command {
  name = "notify";
  description = "Send a notification message to all group members";
  category = CommandCategory.UTILITY;
  aliases = ["n"];
  usage = "!notify <message>";
  examples = [
    "!notify Important meeting at 3 PM",
    "!n Remember to submit your reports",
  ];
  contexts = [CommandContext.GROUP];
  cooldown = 30000;

  async execute(ctx: MessageContext): Promise<void> {
    const message = ctx.args.join(" ");

    if (!message || message.trim() === "") {
      await ctx.reply(
        `You must provide a message to send.\n\n` +
          `Usage: ${this.usage}\n\n` +
          `Example: !n Important announcement`,
      );
      return;
    }

    try {
      const groupMetadata = await ctx.sock.groupMetadata(ctx.chat.jid);
      const participants = groupMetadata.participants.map((p) => p.id);

      const notificationText = `
*ANNOUNCEMENT*

${message}

> _*By VaniaBot*_ 💝
      `.trim();

      await ctx.sock.sendMessage(
        ctx.chat.jid,
        {
          text: notificationText,
          mentions: participants,
        },
        { quoted: ctx.message },
      );

      await ctx.react("✅");
    } catch (error) {
      console.error("Error in NotifyCommand:", error);
      await ctx.reply(
        "Failed to send notification (bot may lack permissions).",
      );
    }
  }
}
