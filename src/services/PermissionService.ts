import type { WASocket } from "@whiskeysockets/baileys";
import { config } from "@/config/index.js";
import { logError } from "@/utils/logger.js";

export interface UserPermissions {
  isOwner: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export interface BotPermissions {
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export function normalizeJid(jid: string): string {
  if (!jid) return jid;
  const [user, server] = jid.split("@");
  const phone = user.split(":")[0];
  return `${phone}@${server}`;
}

export function getBotJid(sock: WASocket): string {
  return normalizeJid(sock.user?.id ?? "");
}

export function getBotLid(sock: WASocket): string | null {
  const lid = (sock.user as any)?.lid;
  if (!lid) return null;
  return normalizeJid(lid);
}

export function getBotPhone(sock: WASocket): string {
  return (sock.user?.id ?? "").split(":")[0].split("@")[0];
}

function isLidJid(jid: string): boolean {
  return jid.endsWith("@lid");
}

export class PermissionService {
  private static groupMetadataCache = new Map<
    string,
    { data: any; timestamp: number }
  >();
  private static lidPhoneCache = new Map<string, string>();

  private static readonly CACHE_TTL = 5 * 60 * 1000;

  static isOwner(jid: string): boolean {
    const phoneNumber = normalizeJid(jid).split("@")[0];
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
      this.groupMetadataCache.set(groupJid, { data: metadata, timestamp: now });
      return metadata;
    } catch (error) {
      logError(`Error obteniendo metadatos del grupo ${groupJid}:`, error);
      return null;
    }
  }

  private static async resolveParticipantPhone(
    sock: WASocket,
    lidJid: string,
  ): Promise<string | null> {
    const cached = this.lidPhoneCache.get(lidJid);
    if (cached) return cached;

    try {
      const result = await (sock as any).onWhatsApp(lidJid);
      console.log(`[LID RESOLVE] ${lidJid} →`, JSON.stringify(result));
      if (result && result[0]?.jid) {
        const phone = result[0].jid.split("@")[0].split(":")[0];
        this.lidPhoneCache.set(lidJid, phone);
        return phone;
      }
    } catch (err) {
      console.log(`[LID RESOLVE ERROR] ${lidJid}:`, err);
    }

    return null;
  }

  private static async findParticipantByPhone(
    sock: WASocket,
    participants: any[],
    phoneNumber: string,
  ): Promise<any | null> {
    console.log(`[FIND] Buscando teléfono: ${phoneNumber}`);
    for (const p of participants) {
      if (isLidJid(p.id)) {
        const resolvedPhone = await this.resolveParticipantPhone(sock, p.id);
        console.log(`[FIND] ${p.id} → resuelto: ${resolvedPhone}`);
        if (resolvedPhone === phoneNumber) return p;
      } else {
        const pPhone = p.id.split("@")[0].split(":")[0];
        console.log(`[FIND] ${p.id} → teléfono: ${pPhone}`);
        if (pPhone === phoneNumber) return p;
      }
    }
    console.log(`[FIND] No encontrado para: ${phoneNumber}`);
    return null;
  }

  static invalidateCache(groupJid: string): void {
    this.groupMetadataCache.delete(groupJid);
  }

  static clearCache(): void {
    this.groupMetadataCache.clear();
    this.lidPhoneCache.clear();
  }

  static async getUserPermissions(
    sock: WASocket,
    groupJid: string | undefined,
    userJid: string,
  ): Promise<UserPermissions> {
    const isOwner = this.isOwner(userJid);

    if (!groupJid) {
      return { isOwner, isAdmin: false, isSuperAdmin: false };
    }

    if (isOwner) {
      return { isOwner: true, isAdmin: true, isSuperAdmin: true };
    }

    try {
      const metadata = await this.getGroupMetadata(sock, groupJid);
      if (!metadata)
        return { isOwner: false, isAdmin: false, isSuperAdmin: false };

      let participant: any;

      if (isLidJid(userJid)) {
        participant = metadata.participants.find(
          (p: any) => normalizeJid(p.id) === normalizeJid(userJid),
        );
      } else {
        const userPhone = userJid.split("@")[0].split(":")[0];
        participant = await this.findParticipantByPhone(
          sock,
          metadata.participants,
          userPhone,
        );
      }

      if (!participant)
        return { isOwner: false, isAdmin: false, isSuperAdmin: false };

      return {
        isOwner: false,
        isAdmin:
          participant.admin === "admin" || participant.admin === "superadmin",
        isSuperAdmin: participant.admin === "superadmin",
      };
    } catch (error) {
      logError("Error obteniendo permisos de usuario:", error);
      return { isOwner: false, isAdmin: false, isSuperAdmin: false };
    }
  }

  static async getBotPermissions(
    sock: WASocket,
    groupJid: string,
  ): Promise<BotPermissions> {
    try {
      const metadata = await this.getGroupMetadata(sock, groupJid);
      if (!metadata) return { isAdmin: false, isSuperAdmin: false };

      const botLid = getBotLid(sock);
      const botPhone = getBotPhone(sock);

      let botParticipant: any = null;

      if (botLid) {
        botParticipant = metadata.participants.find(
          (p: any) => normalizeJid(p.id) === botLid,
        );
      }

      if (!botParticipant && botPhone) {
        botParticipant = metadata.participants.find((p: any) => {
          if (!isLidJid(p.id)) {
            return p.id.split("@")[0].split(":")[0] === botPhone;
          }
          return false;
        });
      }

      if (!botParticipant) return { isAdmin: false, isSuperAdmin: false };

      return {
        isAdmin:
          botParticipant.admin === "admin" ||
          botParticipant.admin === "superadmin",
        isSuperAdmin: botParticipant.admin === "superadmin",
      };
    } catch (error) {
      logError("Error obteniendo permisos del bot:", error);
      return { isAdmin: false, isSuperAdmin: false };
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
      if (!metadata) return [];
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
      if (!metadata) return false;

      if (isLidJid(userJid)) {
        return metadata.participants.some(
          (p: any) => normalizeJid(p.id) === normalizeJid(userJid),
        );
      }

      const userPhone = userJid.split("@")[0].split(":")[0];
      const participant = await this.findParticipantByPhone(
        sock,
        metadata.participants,
        userPhone,
      );
      return participant !== null;
    } catch (error) {
      logError("Error verificando participante:", error);
      return false;
    }
  }
}
