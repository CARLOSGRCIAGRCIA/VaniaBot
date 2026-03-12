import { Command } from "../../Command.js";
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
} from "@/types/index.js";
import type { MessageContext } from "@/types/index.js";
import { serviceManager } from "@/services/system/Servicemanager.js";

export class WarnCommand extends Command {
  name = "warn";
  description = "Warn a user (3 warnings = automatic kick)";
  category = CommandCategory.ADMIN;
  aliases = ["warn"];
  usage = "!warn @user [reason]";
  examples = ["!warn @user spam", "!warn @user excessive mentions"];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const mentionedJid =
      ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (!mentionedJid) {
      await ctx.reply("Please mention a user to warn.");
      return;
    }

    if (mentionedJid === ctx.sender.jid) {
      await ctx.reply("You cannot warn yourself.");
      return;
    }

    const reason = ctx.args.slice(1).join(" ") || "No reason provided";

    const newWarnings =
      await serviceManager.userService.addWarning(mentionedJid);

    const user = await serviceManager.userService.getUser(mentionedJid);

    if (newWarnings >= 3) {
      if (ctx.chat.isBotAdmin) {
        try {
          await ctx.sock.groupParticipantsUpdate(
            ctx.chat.jid,
            [mentionedJid],
            "remove",
          );

          await ctx.reply(
            `*USER KICKED*\n\n` +
              `User: ${user.name}\n` +
              `Warnings reached: 3/3\n` +
              `Last reason: ${reason}`,
          );
        } catch {
          await ctx.reply("Could not kick the user (missing permissions?).");
        }
      } else {
        await ctx.reply(
          `*WARNING LIMIT REACHED*\n\n` +
            `User: ${user.name}\n` +
            `Warnings: 3/3\n` +
            `Last reason: ${reason}\n\n` +
            `The bot is not admin, so automatic kick failed.`,
        );
      }
    } else {
      await ctx.reply(
        `*WARNING ISSUED*\n\n` +
          `User: ${user.name}\n` +
          `Current warnings: ${newWarnings}/3\n` +
          `Reason: ${reason}\n\n` +
          `At 3 warnings, the user will be automatically kicked.`,
      );
    }
  }
}
