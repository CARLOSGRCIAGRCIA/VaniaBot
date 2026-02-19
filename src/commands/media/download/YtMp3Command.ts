import { Command } from "../../Command.js";
import { CommandCategory, type MessageContext } from "@/types/index.js";
import { YouTubeDownloader } from "@/services/download/YouTubeDownloader.js";
import fs from "fs";

export class YtMp3Command extends Command {
  name = "ytmp3";
  description = "Download YouTube audio as MP3";
  category = CommandCategory.MEDIA;
  aliases = ["yta", "ytaudio"];
  usage = "!ytmp3 <search or URL>";
  examples = ["!ytmp3 bad bunny", "!ytmp3 https://youtu.be/dQw4w9WgXcQ"];
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
          "Usage: !ytmp3 <search or URL>\n" +
          "📝 Example: !ytmp3 bad bunny",
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
        `🎵 *Found:* ${video.title}\n` +
          `⏱️ *Duration:* ${video.duration}\n\n` +
          `⬇️ Downloading audio...`,
      );

      await ctx.react("⏳");

      const result = await this.downloader.downloadAudio(video.videoId);

      if (!result.success) {
        await ctx.react("");
        await ctx.reply(` Download failed\n\n${result.error}`);
        return;
      }

      await ctx.sock.sendMessage(ctx.chat.jid, {
        audio: fs.readFileSync(result.filePath!),
        mimetype: "audio/mpeg",
        fileName: `${this.downloader["sanitizeFilename"](video.title)}.mp3`,
      });

      await ctx.react("✅");

      await this.downloader["cleanup"](result.filePath!);
    } catch (error: any) {
      console.error("Error in YtMp3Command:", error);
      await ctx.react("");
      await ctx.reply(` Error: ${error.message}`);
    }
  }
}
