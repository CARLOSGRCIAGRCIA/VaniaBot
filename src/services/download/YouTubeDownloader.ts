import { DownloadService, DownloadResult } from "./DownloadService.js";
import yts from "yt-search";
import fs from "fs";

export interface YouTubeVideo {
  videoId: string;
  title: string;
  duration: string;
  thumbnail: string;
  url: string;
}

export class YouTubeDownloader extends DownloadService {
  extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  async searchVideo(query: string): Promise<YouTubeVideo | null> {
    try {
      if (query.includes("youtube.com") || query.includes("youtu.be")) {
        const videoId = this.extractVideoId(query);
        if (!videoId) return null;

        const options: { videoId: string } = { videoId };
        const result = await yts(options);

        return {
          videoId: result.videoId,
          title: result.title,
          duration: result.timestamp,
          thumbnail: result.thumbnail,
          url: result.url,
        };
      }

      const results = await yts(query);
      if (!results.videos.length) return null;

      const video = results.videos[0];
      return {
        videoId: video.videoId,
        title: video.title,
        duration: video.timestamp,
        thumbnail: video.thumbnail,
        url: video.url,
      };
    } catch (error) {
      console.error("YouTube search error:", error);
      return null;
    }
  }

  async downloadAudio(videoId: string): Promise<DownloadResult> {
    const outputPath = this.generateOutputPath(videoId, "mp3");

    const methods = [
      {
        name: "yt-dlp",
        cmd: "yt-dlp",
        args: [
          "-x",
          "--audio-format",
          "mp3",
          "--audio-quality",
          "0",
          "-o",
          outputPath,
          `https://youtu.be/${videoId}`,
        ],
      },
      {
        name: "youtube-dl",
        cmd: "youtube-dl",
        args: [
          "-x",
          "--audio-format",
          "mp3",
          "-o",
          outputPath,
          `https://youtu.be/${videoId}`,
        ],
      },
    ];

    return await this.tryDownloadMethods(methods, outputPath, "audio");
  }

  async downloadVideo(videoId: string): Promise<DownloadResult> {
    const outputPath = this.generateOutputPath(videoId, "mp4");

    const methods = [
      {
        name: "yt-dlp",
        cmd: "yt-dlp",
        args: [
          "-f",
          "best[height<=720]",
          "-o",
          outputPath,
          `https://youtu.be/${videoId}`,
        ],
      },
      {
        name: "youtube-dl",
        cmd: "youtube-dl",
        args: [
          "-f",
          "best[height<=480]",
          "-o",
          outputPath,
          `https://youtu.be/${videoId}`,
        ],
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
        console.log(`🔄 Trying ${method.name}...`);

        await this.runCommand(method.cmd, method.args, 180000);

        if (fs.existsSync(outputPath)) {
          const sizeCheck = this.checkFileSize(outputPath, type);

          if (!sizeCheck.valid) {
            fs.unlinkSync(outputPath);
            return {
              success: false,
              error: `File too large: ${sizeCheck.sizeMB}MB`,
            };
          }

          console.log(`✅ ${method.name} succeeded: ${sizeCheck.sizeMB}MB`);

          return {
            success: true,
            filePath: outputPath,
            size: sizeCheck.sizeMB.toString(),
            source: method.name,
          };
        }
      } catch (error: any) {
        console.log(`❌ ${method.name} failed:`, error.message);
        continue;
      }
    }

    return {
      success: false,
      error: "Install yt-dlp: sudo apt install yt-dlp ffmpeg",
    };
  }
}
