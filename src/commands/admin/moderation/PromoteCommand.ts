import { Command } from "../../Command.js";
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  BotPermission,
  type MessageContext,
} from "@/types/index.js";
import { serviceManager } from "@/services/system/Servicemanager.js";

export class PromoteCommand extends Command {
  name = "promote";
  description = "Promote a user to admin";
  category = CommandCategory.MODERATION;
  aliases = ["promover", "admin"];
  usage = "!promote @user";
  examples = ["!promote @user"];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
    bot: [BotPermission.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const mentionedJid =
      ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (!mentionedJid) {
      await ctx.reply("❌ You must mention a user to promote");
      return;
    }

    if (mentionedJid === ctx.sender.jid) {
      await ctx.reply("❌ You cannot promote yourself");
      return;
    }

    if (mentionedJid === ctx.sock.user?.id.split(":")[0] + "@s.whatsapp.net") {
      await ctx.reply("The bot is already an admin");
      return;
    }

    await ctx.react("⏳");

    try {
      const groupMetadata = await ctx.sock.groupMetadata(ctx.chat.jid);
      const participant = groupMetadata.participants.find(
        (p) => p.id === mentionedJid,
      );

      if (!participant) {
        await ctx.reply("❌ User not found in group");
        return;
      }

      if (participant.admin === "admin" || participant.admin === "superadmin") {
        await ctx.reply("⚠️ This user is already an admin");
        return;
      }

      const targetUser = await serviceManager.userService.getUser(mentionedJid);

      await ctx.sock.groupParticipantsUpdate(
        ctx.chat.jid,
        [mentionedJid],
        "promote",
      );

      await serviceManager.moderationService.logAction({
        userId: mentionedJid,
        userName: targetUser.name,
        action: "warn",
        reason: "Promoted to admin",
        moderator: ctx.sender.pushName || "Unknown",
        timestamp: Date.now(),
      });

      await ctx.reply(
        `👑 *User Promoted*\n\n` +
          `👤 User: ${targetUser.name}\n` +
          `🎖️ New Role: Admin\n` +
          `👮 By: ${ctx.sender.pushName}\n` +
          `📅 Date: ${new Date().toLocaleString()}\n\n` +
          `✅ User can now manage group settings`,
      );

      await ctx.react("✅");
    } catch (error: any) {
      console.error("Error in PromoteCommand:", error);
      await ctx.reply(`❌ Error promoting user: ${error.message}`);
      await ctx.react("❌");
    }
  }
}
