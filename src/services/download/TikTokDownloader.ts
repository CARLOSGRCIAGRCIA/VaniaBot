import { DownloadService, DownloadResult } from "./DownloadService.js";
import fs from "fs";

export interface TikTokVideo {
  title: string;
  author: string;
  url: string;
}

export class TikTokDownloader extends DownloadService {
  isValidUrl(url: string): boolean {
    return /tiktok\.com\//i.test(url) || /vm\.tiktok\.com\//i.test(url);
  }

  async getVideoInfo(url: string): Promise<TikTokVideo | null> {
    try {
      const output = await this.runCommand(
        "yt-dlp",
        ["--dump-json", "--no-download", url],
        30000,
      );
      const info = JSON.parse(output.trim().split("\n")[0]);
      return {
        title: info.title ?? "TikTok video",
        author: info.uploader ?? info.creator ?? "unknown",
        url,
      };
    } catch (error) {
      console.error("TikTok getVideoInfo error:", error);
      return null;
    }
  }

  async downloadVideo(url: string): Promise<DownloadResult> {
    const outputPath = this.generateOutputPath("tiktok", "mp4");

    const methods = [
      {
        name: "yt-dlp (no watermark)",
        cmd: "yt-dlp",
        args: ["-f", "best", "--no-check-certificate", "-o", outputPath, url],
      },
      {
        name: "yt-dlp (fallback)",
        cmd: "yt-dlp",
        args: ["-o", outputPath, url],
      },
    ];

    return await this.tryDownloadMethods(methods, outputPath, "video");
  }

  async downloadAudio(url: string): Promise<DownloadResult> {
    const outputPath = this.generateOutputPath("tiktok_audio", "mp3");

    const methods = [
      {
        name: "yt-dlp audio",
        cmd: "yt-dlp",
        args: [
          "-x",
          "--audio-format",
          "mp3",
          "--audio-quality",
          "0",
          "--no-check-certificate",
          "-o",
          outputPath,
          url,
        ],
      },
    ];

    return await this.tryDownloadMethods(methods, outputPath, "audio");
  }

  private async tryDownloadMethods(
    methods: Array<{ name: string; cmd: string; args: string[] }>,
    outputPath: string,
    type: "audio" | "video",
  ): Promise<DownloadResult> {
    for (const method of methods) {
      try {
        console.log(`🔄 [TikTok] Trying ${method.name}...`);

        await this.runCommand(method.cmd, method.args, 120000);

        if (fs.existsSync(outputPath)) {
          const sizeCheck = this.checkFileSize(outputPath, type);

          if (!sizeCheck.valid) {
            fs.unlinkSync(outputPath);
            return {
              success: false,
              error: `File too large: ${sizeCheck.sizeMB}MB`,
            };
          }

          console.log(
            `✅ [TikTok] ${method.name} succeeded: ${sizeCheck.sizeMB}MB`,
          );

          return {
            success: true,
            filePath: outputPath,
            size: sizeCheck.sizeMB.toString(),
            source: method.name,
          };
        }
      } catch (error: any) {
        console.log(`❌ [TikTok] ${method.name} failed:`, error.message);
        continue;
      }
    }

    return {
      success: false,
      error:
        "Download failed. Make sure yt-dlp is installed: sudo apt install yt-dlp ffmpeg",
    };
  }
}
