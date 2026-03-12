import { Command } from "../Command.js";
import { CommandCategory } from "@/types/index.js";
import type { MessageContext } from "@/types/index.js";
import { serviceManager } from "@/services/system/Servicemanager.js";
import { formatNumber } from "@/utils/helpers.js";

export class PayCommand extends Command {
  name = "pay";
  description = "Transfer money to another user";
  category = CommandCategory.ECONOMY;
  aliases = ["pay", "transfer"];
  usage = "!pay @user <quantity>";
  examples = ["!pay @5215551234567 500"];
  cooldown = 5000;

  async execute(ctx: MessageContext): Promise<void> {
    const mentionedJid =
      ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (!mentionedJid) {
      await ctx.reply(
        "You must mention a user.\n\nUsage: !pay @user <quantity>",
      );
      return;
    }

    if (mentionedJid === ctx.sender.jid) {
      await ctx.reply("You cannot transfer money to yourself.");
      return;
    }

    const amountStr = ctx.args[1];
    const amount = parseInt(amountStr);

    if (!amountStr || isNaN(amount) || amount <= 0) {
      await ctx.reply("Invalid amount\n\Usage: !pay @user <quantity>");
      return;
    }

    const sender = await serviceManager.userService.getUser(ctx.sender.jid);

    if (sender.money < amount) {
      await ctx.reply(
        `You don't have enough money.\n\n` +
          `Your balance: $${formatNumber(sender.money)}\n` +
          `You need: $${formatNumber(amount)}`,
      );
      return;
    }

    await serviceManager.userService.removeMoney(ctx.sender.jid, amount);
    await serviceManager.userService.addMoney(mentionedJid, amount);

    const receiver = await serviceManager.userService.getUser(mentionedJid);

    await ctx.reply(
      `*SUCCESSFUL TRANSFER*\n\n` +
        `You sent: $${formatNumber(amount)}\n` +
        `For: ${receiver.name}\n\n` +
        `Your new balance: $${formatNumber(sender.money - amount)}`,
    );
  }
}
