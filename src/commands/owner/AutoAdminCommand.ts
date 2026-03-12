import { Command } from "../Command.js";
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  BotPermission,
  type MessageContext,
} from "@/types/index.js";
import { serviceManager } from "@/services/system/Servicemanager.js";

export class AutoAdminCommand extends Command {
  name = "autoadmin";
  description = "Automatically promote yourself to admin (owner only)";
  category = CommandCategory.OWNER;
  aliases = ["sadmin", "makeadmin"];
  usage = "!autoadmin";
  examples = ["!autoadmin"];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.OWNER],
    bot: [BotPermission.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    try {
      const ownerJid = ctx.sender.jid;

      const groupMetadata = await ctx.sock.groupMetadata(ctx.chat.jid);
      const participant = groupMetadata.participants.find(
        (p) => p.id === ownerJid,
      );

      if (!participant) {
        await ctx.reply(
          "❌ *Error*\n\n" +
            "You are not in this group\n" +
            "This should not happen...",
        );
        return;
      }

      const isAlreadyAdmin =
        participant.admin === "admin" || participant.admin === "superadmin";

      if (isAlreadyAdmin) {
        const role =
          participant.admin === "superadmin" ? "Group Creator" : "Admin";

        await ctx.reply(
          `✅ *Already Admin*\n\n` +
            `👤 You: ${ctx.sender.pushName}\n` +
            `🎖️ Current Role: ${role}\n\n` +
            `ℹ️ You already have admin permissions`,
        );
        return;
      }

      await ctx.sock.groupParticipantsUpdate(
        ctx.chat.jid,
        [ownerJid],
        "promote",
      );

      await serviceManager.moderationService.logAction({
        userId: ownerJid,
        userName: ctx.sender.pushName || "Owner",
        action: "warn",
        reason: "Self-promotion via autoadmin (owner privilege)",
        moderator: "System",
        timestamp: Date.now(),
      });

      await ctx.reply(
        `*Auto-Admin Activated*\n\n` +
          `👤 User: ${ctx.sender.pushName}\n` +
          `🎖️ New Role: Admin\n` +
          `👑 Privilege: Owner\n\n` +
          `> Date: ${new Date().toLocaleString()}`,
      );

      await ctx.react("✅");
    } catch (error: any) {
      console.error("Error in AutoAdminCommand:", error);

      let errorMsg = `❌ *Auto-Admin Failed*\n\n`;

      if (error.message?.includes("not-authorized")) {
        errorMsg +=
          `*Bot is not admin*\n\n` +
          `Solution:\n` +
          `1. Make the bot admin first\n` +
          `2. Then use !autoadmin`;
      } else if (error.message?.includes("forbidden")) {
        errorMsg +=
          `*Bot lacks permissions*\n\n` +
          `The bot needs admin permissions to promote users`;
      } else {
        errorMsg +=
          `⚠️ ${error.message}\n\n` +
          `📝 Common issues:\n` +
          `• Bot must be admin\n` +
          `• You must be in the group\n` +
          `• WhatsApp API limitations`;
      }

      await ctx.reply(errorMsg);
      await ctx.react("❌");
    }
  }
}
