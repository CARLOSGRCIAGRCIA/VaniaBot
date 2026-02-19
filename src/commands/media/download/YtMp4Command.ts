import { Command } from "../../Command.js";
import { CommandCategory, type MessageContext } from "@/types/index.js";
import { YouTubeDownloader } from "@/services/download/YouTubeDownloader.js";
import fs from "fs";

export class YtMp4Command extends Command {
  name = "ytmp4";
  description = "Download YouTube video as MP4";
  category = CommandCategory.MEDIA;
  aliases = ["ytv", "ytvideo"];
  usage = "!ytmp4 <search or URL>";
  examples = ["!ytmp4 tutorial android", "!ytmp4 https://youtu.be/dQw4w9WgXcQ"];
  cooldown = 30000;

  private downloader: YouTubeDownloader;

  constructor() {
    super();
    this.downloader = new YouTubeDownloader();
  }

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args.length) {
      await ctx.reply(
        " Provide a search query or URL\n\n" +
          "Usage: !ytmp4 <search or URL>\n" +
          "📝 Example: !ytmp4 tutorial",
      );
      return;
    }

    const query = ctx.args.join(" ");

    await ctx.react("🔍");

    try {
      const video = await this.downloader.searchVideo(query);

      if (!video) {
        await ctx.react("");
        await ctx.reply(" No results found");
        return;
      }

      await ctx.reply(
        `🎬 *Found:* ${video.title}\n` +
          `⏱️ *Duration:* ${video.duration}\n\n` +
          `⬇️ Downloading video...`,
      );

      await ctx.react("⏳");

      const result = await this.downloader.downloadVideo(video.videoId);

      if (!result.success) {
        await ctx.react("");
        await ctx.reply(` Download failed\n\n${result.error}`);
        return;
      }

      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: fs.readFileSync(result.filePath!),
        mimetype: "video/mp4",
        caption:
          `🎬 ${video.title}\n` +
          `📊 ${result.size}MB\n` +
          `⚡ ${result.source}\n\n` +
          `> By VaniaBot`,
      });

      await ctx.react("✅");

      await this.downloader["cleanup"](result.filePath!);
    } catch (error: any) {
      console.error("Error in YtMp4Command:", error);
      await ctx.react("");
      await ctx.reply(` Error: ${error.message}`);
    }
  }
}
