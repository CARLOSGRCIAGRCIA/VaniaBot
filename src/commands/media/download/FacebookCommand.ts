import { Command } from "../../Command.js";
import { CommandCategory, type MessageContext } from "@/types/index.js";
import { FacebookDownloader } from "@/services/download/FacebookDownloader.js";
import fs from "fs";

export class FacebookCommand extends Command {
  name = "facebook";
  description = "Download Facebook videos and Reels";
  category = CommandCategory.MEDIA;
  aliases = ["fb", "fbvideo"];
  usage = "!facebook <URL>";
  examples = [
    "!facebook https://www.facebook.com/watch/?v=123456789",
    "!fb https://fb.watch/XXXXXXXXXX/",
  ];
  cooldown = 30000;

  private downloader: FacebookDownloader;

  constructor() {
    super();
    this.downloader = new FacebookDownloader();
  }

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args.length) {
      await ctx.reply(
        " Provide a Facebook video URL\n\n" +
          "Usage: !facebook <URL>\n" +
          " Example: !facebook https://fb.watch/XXXXXXXXXX/",
      );
      return;
    }

    const url = ctx.args[0];

    if (!this.downloader.isValidUrl(url)) {
      await ctx.reply(
        " Invalid URL. Please send a valid Facebook video link.\n" +
          "⚠️ Only public videos are supported.",
      );
      return;
    }

    await ctx.react("🔍");

    try {
      const info = await this.downloader.getVideoInfo(url);

      if (info) {
        await ctx.reply(
          `📘 *Author:* ${info.author}\n` +
            ` *Title:* ${info.title.substring(0, 80)}\n\n` +
            `Downloading...`,
        );
      } else {
        await ctx.reply("⬇️ Downloading Facebook video...");
      }

      await ctx.react("⏳");

      const result = await this.downloader.downloadVideo(url);

      if (!result.success) {
        await ctx.react("");
        await ctx.reply(` Download failed\n\n${result.error}`);
        return;
      }

      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: fs.readFileSync(result.filePath!),
        mimetype: "video/mp4",
        caption:
          (info ? `📘 ${info.author}\n` : "") +
          `📊 ${result.size}MB\n` +
          `⚡ ${result.source}\n\n` +
          `> By VaniaBot`,
      });

      await ctx.react("✅");

      await this.downloader["cleanup"](result.filePath!);
    } catch (error: any) {
      console.error("Error in FacebookCommand:", error);
      await ctx.react("");
      await ctx.reply(` Error: ${error.message}`);
    }
  }
}
