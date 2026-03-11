import { Command } from "../Command.js";
import { CommandCategory } from "@/types/index.js";
import type { MessageContext } from "@/types/index.js";
import fs from "fs";
import path from "path";

export class RulesCLKCommand extends Command {
  name = "rules clk";
  description = "Reglas CLK";
  category = CommandCategory.UTILITY;
  aliases = ["rules clk"];
  usage = "!rules clk";
  examples = ["!rules clk"];

  async execute(ctx: MessageContext): Promise<void> {
    const imagePath = path.join(
      process.cwd(),
      "data",
      "assets",
      "clkRules.png",
    );
    const imageBuffer = fs.readFileSync(imagePath);

    await ctx.sock.sendMessage(
      ctx.chat.jid,
      { image: imageBuffer },
      { quoted: ctx.message },
    );
  }
}

export default RulesCLKCommand;
