import axios from "axios";
import { logger, logError } from "@/utils/logger.js";

export interface DownloadResult {
  success: boolean;
  data?: Buffer;
  filename?: string;
  mimeType?: string;
  size?: number;
  error?: string;
}

export interface MediaInfo {
  title?: string;
  duration?: string;
  thumbnail?: string;
  author?: string;
  description?: string;
  url: string;
}

export class DownloadService {
  private static readonly MAX_SIZE = 50 * 1024 * 1024;
  private static readonly TIMEOUT = 60000;

  static async downloadFile(url: string): Promise<DownloadResult> {
    try {
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: this.TIMEOUT,
        maxContentLength: this.MAX_SIZE,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      const buffer = Buffer.from(response.data);
      const filename = this.extractFilename(
        url,
        response.headers["content-type"],
      );
      const mimeType =
        response.headers["content-type"] || "application/octet-stream";

      return {
        success: true,
        data: buffer,
        filename,
        mimeType,
        size: buffer.length,
      };
    } catch (error: any) {
      logError("DownloadService.downloadFile", error);

      return {
        success: false,
        error: error.message || "Error descargando archivo",
      };
    }
  }

  static async downloadImage(url: string): Promise<DownloadResult> {
    const result = await this.downloadFile(url);

    if (!result.success) {
      return result;
    }

    const validImageTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];

    if (!validImageTypes.includes(result.mimeType || "")) {
      return {
        success: false,
        error: "El archivo no es una imagen válida",
      };
    }

    return result;
  }

  static async downloadVideo(url: string): Promise<DownloadResult> {
    const result = await this.downloadFile(url);

    if (!result.success) {
      return result;
    }

    const validVideoTypes = ["video/mp4", "video/webm", "video/quicktime"];

    if (!validVideoTypes.includes(result.mimeType || "")) {
      return {
        success: false,
        error: "El archivo no es un video válido",
      };
    }

    return result;
  }

  static async downloadAudio(url: string): Promise<DownloadResult> {
    const result = await this.downloadFile(url);

    if (!result.success) {
      return result;
    }

    const validAudioTypes = [
      "audio/mpeg",
      "audio/mp3",
      "audio/ogg",
      "audio/wav",
    ];

    if (!validAudioTypes.includes(result.mimeType || "")) {
      return {
        success: false,
        error: "El archivo no es audio válido",
      };
    }

    return result;
  }

  private static extractFilename(url: string, mimeType?: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split("/").pop() || "download";

      if (!filename.includes(".") && mimeType) {
        const extension = this.getExtensionFromMimeType(mimeType);
        return `${filename}.${extension}`;
      }

      return filename;
    } catch {
      return "download";
    }
  }

  private static getExtensionFromMimeType(mimeType: string): string {
    const mimeMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "video/mp4": "mp4",
      "video/webm": "webm",
      "audio/mpeg": "mp3",
      "audio/ogg": "ogg",
      "audio/wav": "wav",
    };

    return mimeMap[mimeType] || "bin";
  }

  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static async getFileSize(url: string): Promise<number | null> {
    try {
      const response = await axios.head(url, {
        timeout: 5000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      const size = parseInt(response.headers["content-length"] || "0", 10);
      return size > 0 ? size : null;
    } catch {
      return null;
    }
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }
}
