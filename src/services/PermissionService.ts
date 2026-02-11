import type { WASocket } from "@whiskeysockets/baileys";
import { config } from "@/config/index.js";
import { logger, logError } from "@/utils/logger.js";

export interface UserPermissions {
  isOwner: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export interface BotPermissions {
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export class PermissionService {
  private static groupMetadataCache = new Map<
    string,
    {
      data: any;
      timestamp: number;
    }
  >();

  private static readonly CACHE_TTL = 5 * 60 * 1000;

  static isOwner(jid: string): boolean {
    const phoneNumber = jid.split("@")[0];
    return config.owners.includes(phoneNumber);
  }

  private static async getGroupMetadata(
    sock: WASocket,
    groupJid: string,
  ): Promise<any> {
    const cached = this.groupMetadataCache.get(groupJid);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const metadata = await sock.groupMetadata(groupJid);
      this.groupMetadataCache.set(groupJid, {
        data: metadata,
        timestamp: now,
      });
      return metadata;
    } catch (error) {
      logError(`Error obteniendo metadatos del grupo ${groupJid}:`, error);
      return null;
    }
  }

  static invalidateCache(groupJid: string): void {
    this.groupMetadataCache.delete(groupJid);
  }

  static clearCache(): void {
    this.groupMetadataCache.clear();
  }

  static async getUserPermissions(
    sock: WASocket,
    groupJid: string | undefined,
    userJid: string,
  ): Promise<UserPermissions> {
    const isOwner = this.isOwner(userJid);

    if (!groupJid) {
      return {
        isOwner,
        isAdmin: false,
        isSuperAdmin: false,
      };
    }

    if (isOwner) {
      return {
        isOwner: true,
        isAdmin: true,
        isSuperAdmin: true,
      };
    }

    try {
      const metadata = await this.getGroupMetadata(sock, groupJid);

      if (!metadata) {
        return {
          isOwner: false,
          isAdmin: false,
          isSuperAdmin: false,
        };
      }

      const participant = metadata.participants.find(
        (p: any) => p.id === userJid,
      );

      if (!participant) {
        return {
          isOwner: false,
          isAdmin: false,
          isSuperAdmin: false,
        };
      }

      const isAdmin =
        participant.admin === "admin" || participant.admin === "superadmin";
      const isSuperAdmin = participant.admin === "superadmin";

      return {
        isOwner: false,
        isAdmin,
        isSuperAdmin,
      };
    } catch (error) {
      logError("Error obteniendo permisos de usuario:", error);
      return {
        isOwner: false,
        isAdmin: false,
        isSuperAdmin: false,
      };
    }
  }

  static async getBotPermissions(
    sock: WASocket,
    groupJid: string,
  ): Promise<BotPermissions> {
    try {
      const metadata = await this.getGroupMetadata(sock, groupJid);

      if (!metadata) {
        return {
          isAdmin: false,
          isSuperAdmin: false,
        };
      }

      const botJid = sock.user?.id;

      if (!botJid) {
        return {
          isAdmin: false,
          isSuperAdmin: false,
        };
      }

      const botParticipant = metadata.participants.find(
        (p: any) =>
          p.id === botJid || p.id.split("@")[0] === botJid.split(":")[0],
      );

      if (!botParticipant) {
        return {
          isAdmin: false,
          isSuperAdmin: false,
        };
      }

      return {
        isAdmin:
          botParticipant.admin === "admin" ||
          botParticipant.admin === "superadmin",
        isSuperAdmin: botParticipant.admin === "superadmin",
      };
    } catch (error) {
      logError("Error obteniendo permisos del bot:", error);
      return {
        isAdmin: false,
        isSuperAdmin: false,
      };
    }
  }

  static async canBotModerate(
    sock: WASocket,
    groupJid: string,
  ): Promise<boolean> {
    const permissions = await this.getBotPermissions(sock, groupJid);
    return permissions.isAdmin;
  }

  static async canUserModerate(
    sock: WASocket,
    groupJid: string,
    userJid: string,
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(sock, groupJid, userJid);
    return permissions.isOwner || permissions.isAdmin;
  }

  static async getGroupAdmins(
    sock: WASocket,
    groupJid: string,
  ): Promise<string[]> {
    try {
      const metadata = await this.getGroupMetadata(sock, groupJid);

      if (!metadata) {
        return [];
      }

      return metadata.participants
        .filter((p: any) => p.admin === "admin" || p.admin === "superadmin")
        .map((p: any) => p.id);
    } catch (error) {
      logError("Error obteniendo administradores:", error);
      return [];
    }
  }

  static async isUserInGroup(
    sock: WASocket,
    groupJid: string,
    userJid: string,
  ): Promise<boolean> {
    try {
      const metadata = await this.getGroupMetadata(sock, groupJid);

      if (!metadata) {
        return false;
      }

      return metadata.participants.some((p: any) => p.id === userJid);
    } catch (error) {
      logError("Error verificando participante:", error);
      return false;
    }
  }
}
