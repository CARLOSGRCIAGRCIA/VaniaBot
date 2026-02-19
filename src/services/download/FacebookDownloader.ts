import { DownloadService, DownloadResult } from "./DownloadService.js";
import fs from "fs";

export interface FacebookVideo {
  title: string;
  author: string;
  url: string;
}

export class FacebookDownloader extends DownloadService {
  isValidUrl(url: string): boolean {
    return (
      /facebook\.com\/(watch|reel|reels|videos)\//i.test(url) ||
      /facebook\.com\/share\/(v|r|p)\//i.test(url) ||
      /facebook\.com\/[^/]+\/videos\//i.test(url) ||
      /fb\.watch\//i.test(url)
    );
  }

  async getVideoInfo(url: string): Promise<FacebookVideo | null> {
    try {
      const output = await this.runCommand(
        "yt-dlp",
        ["--dump-json", "--no-download", url],
        30000,
      );
      const info = JSON.parse(output.trim().split("\n")[0]);
      return {
        title: info.title ?? "Facebook video",
        author: info.uploader ?? info.channel ?? "unknown",
        url,
      };
    } catch (error) {
      console.error("Facebook getVideoInfo error:", error);
      return null;
    }
  }

  async downloadVideo(url: string): Promise<DownloadResult> {
    const outputPath = this.generateOutputPath("facebook", "mp4");

    const methods = [
      {
        name: "yt-dlp HD",
        cmd: "yt-dlp",
        args: [
          "-f",
          "best[height<=720]",
          "--no-check-certificate",
          "-o",
          outputPath,
          url,
        ],
      },
      {
        name: "yt-dlp SD",
        cmd: "yt-dlp",
        args: ["-f", "worst", "--no-check-certificate", "-o", outputPath, url],
      },
      {
        name: "yt-dlp (fallback)",
        cmd: "yt-dlp",
        args: ["--no-check-certificate", "-o", outputPath, url],
      },
    ];

    return await this.tryDownloadMethods(methods, outputPath, "video");
  }

  private async tryDownloadMethods(
    methods: Array<{ name: string; cmd: string; args: string[] }>,
    outputPath: string,
    type: "audio" | "video",
  ): Promise<DownloadResult> {
    for (const method of methods) {
      try {
        console.log(`🔄 [Facebook] Trying ${method.name}...`);

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
            `✅ [Facebook] ${method.name} succeeded: ${sizeCheck.sizeMB}MB`,
          );

          return {
            success: true,
            filePath: outputPath,
            size: sizeCheck.sizeMB.toString(),
            source: method.name,
          };
        }
      } catch (error: any) {
        console.log(`❌ [Facebook] ${method.name} failed:`, error.message);
        continue;
      }
    }

    return {
      success: false,
      error:
        "Download failed. Note: private Facebook videos cannot be downloaded.\n" +
        "Make sure yt-dlp is updated: yt-dlp -U",
    };
  }
}
