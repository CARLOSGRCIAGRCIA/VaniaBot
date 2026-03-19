import type { WASocket, GroupParticipant } from '@whiskeysockets/baileys';
import { config } from '@/config/index.js';
import { logError, logger } from '@/utils/logger.js';

export interface UserPermissions {
  isOwner: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export interface BotPermissions {
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

interface GroupMetadataLike {
  participants: GroupParticipant[];
  subject: string;
  desc?: string;
}

interface SockUser {
  id?: string;
  lid?: string;
}

export function normalizeJid(jid: string): string {
  if (!jid) return jid;
  const [user, server] = jid.split('@');
  const phone = user.split(':')[0];
  return `${phone}@${server}`;
}

export function getBotJid(sock: WASocket): string {
  return normalizeJid(sock.user?.id ?? '');
}

export function getBotLid(sock: WASocket): string | null {
  const lid = (sock.user as SockUser | undefined)?.lid;
  if (!lid) return null;
  return normalizeJid(lid);
}

export function getBotPhone(sock: WASocket): string {
  return (sock.user?.id ?? '').split(':')[0].split('@')[0];
}

function isLidJid(jid: string): boolean {
  return jid.endsWith('@lid');
}

export class PermissionService {
  private static groupMetadataCache = new Map<
    string,
    { data: GroupMetadataLike; timestamp: number }
  >();
  private static lidPhoneCache = new Map<string, string>();
  private static readonly CACHE_TTL = 5 * 60 * 1000;

  static isOwner(jid: string): boolean {
    const normalizedJid = normalizeJid(jid);
    const phoneNumber = normalizedJid.split('@')[0];

    if (isLidJid(normalizedJid)) {
      const cachedPhone = this.lidPhoneCache.get(normalizedJid);
      if (cachedPhone) {
        return config.owners.some(owner => {
          const ownerPhone = normalizeJid(owner).split('@')[0];
          return cachedPhone === ownerPhone;
        });
      }
      return false;
    }

    for (const owner of config.owners) {
      const normalizedOwner = normalizeJid(owner);
      const ownerPhone = normalizedOwner.split('@')[0];
      if (normalizedJid === normalizedOwner || phoneNumber === ownerPhone) {
        return true;
      }
    }
    return false;
  }

  static async isOwnerAsync(sock: WASocket, jid: string): Promise<boolean> {
    const normalizedJid = normalizeJid(jid);
    const phoneNumber = normalizedJid.split('@')[0];

    if (isLidJid(normalizedJid)) {
      const cachedPhone = this.lidPhoneCache.get(normalizedJid);
      if (cachedPhone) {
        return config.owners.some(owner => {
          const ownerPhone = normalizeJid(owner).split('@')[0];
          return cachedPhone === ownerPhone;
        });
      }
      const resolvedPhone = await this.resolveLidToPhone(sock, normalizedJid);
      if (resolvedPhone) {
        return config.owners.some(owner => {
          const ownerPhone = normalizeJid(owner).split('@')[0];
          return resolvedPhone === ownerPhone;
        });
      }
      return false;
    }

    for (const owner of config.owners) {
      const normalizedOwner = normalizeJid(owner);
      const ownerPhone = normalizedOwner.split('@')[0];
      if (normalizedJid === normalizedOwner || phoneNumber === ownerPhone) {
        return true;
      }
    }
    return false;
  }

  private static async resolveLidToPhone(sock: WASocket, lidJid: string): Promise<string | null> {
    const cached = this.lidPhoneCache.get(lidJid);
    if (cached) return cached;

    try {
      const onWhatsApp = (
        sock as unknown as { onWhatsApp?: (jid: string) => Promise<Array<{ jid?: string }>> }
      ).onWhatsApp;
      if (!onWhatsApp) return null;

      const result = await onWhatsApp.call(sock, lidJid);
      if (result && result[0]?.jid) {
        const phone = result[0].jid.split('@')[0].split(':')[0];
        this.lidPhoneCache.set(lidJid, phone);
        return phone;
      }
    } catch {
      logger.debug(`[LID RESOLVE] Failed for ${lidJid}`);
    }
    return null;
  }

  private static async getGroupMetadata(
    sock: WASocket,
    groupJid: string,
  ): Promise<GroupMetadataLike | null> {
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
      // onWhatsApp is not in the public Baileys types — cast carefully
      const onWhatsApp = (
        sock as unknown as { onWhatsApp?: (jid: string) => Promise<Array<{ jid?: string }>> }
      ).onWhatsApp;
      if (!onWhatsApp) return null;

      const result = await onWhatsApp.call(sock, lidJid);
      console.log(`[LID RESOLVE] ${lidJid} →`, JSON.stringify(result));
      if (result && result[0]?.jid) {
        const phone = result[0].jid.split('@')[0].split(':')[0];
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
    participants: GroupParticipant[],
    phoneNumber: string,
  ): Promise<GroupParticipant | null> {
    console.log(`[FIND] Buscando teléfono: ${phoneNumber}`);
    for (const p of participants) {
      if (isLidJid(p.id)) {
        const resolvedPhone = await this.resolveParticipantPhone(sock, p.id);
        console.log(`[FIND] ${p.id} → resuelto: ${resolvedPhone}`);
        if (resolvedPhone === phoneNumber) return p;
      } else {
        const pPhone = p.id.split('@')[0].split(':')[0];
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
      if (!metadata) return { isOwner: false, isAdmin: false, isSuperAdmin: false };

      let participant: GroupParticipant | undefined | null;

      if (isLidJid(userJid)) {
        participant = metadata.participants.find(p => normalizeJid(p.id) === normalizeJid(userJid));
      } else {
        const userPhone = userJid.split('@')[0].split(':')[0];
        participant = await this.findParticipantByPhone(sock, metadata.participants, userPhone);
      }

      if (!participant) return { isOwner: false, isAdmin: false, isSuperAdmin: false };

      return {
        isOwner: false,
        isAdmin: participant.admin === 'admin' || participant.admin === 'superadmin',
        isSuperAdmin: participant.admin === 'superadmin',
      };
    } catch (error) {
      logError('Error obteniendo permisos de usuario:', error);
      return { isOwner: false, isAdmin: false, isSuperAdmin: false };
    }
  }

  static async getBotPermissions(sock: WASocket, groupJid: string): Promise<BotPermissions> {
    try {
      let metadata = await this.getGroupMetadata(sock, groupJid);

      if (!metadata || metadata.participants.length === 0) {
        this.invalidateCache(groupJid);
        metadata = await sock.groupMetadata(groupJid);
      }

      if (!metadata) return { isAdmin: false, isSuperAdmin: false };

      const botId = sock.user?.id;
      if (!botId) {
        logger.debug('[PERMS] Bot no tiene ID de usuario');
        return { isAdmin: false, isSuperAdmin: false };
      }

      const botPhone = getBotPhone(sock);
      const botJidNormalized = normalizeJid(botId);
      const botLid = getBotLid(sock);

      logger.debug(`[PERMS] Buscando bot - ID: ${botId}, Phone: ${botPhone}, LID: ${botLid}`);
      logger.debug(`[PERMS] Total participantes: ${metadata.participants.length}`);

      let botParticipant: GroupParticipant | undefined = undefined;

      for (const p of metadata.participants) {
        const pNormalized = normalizeJid(p.id);

        if (pNormalized === botJidNormalized) {
          botParticipant = p;
          logger.debug(`[PERMS] Encontrado por JID normalizado: ${p.id}`);
          break;
        }

        const pPhone = p.id.split('@')[0].split(':')[0];
        if (pPhone === botPhone) {
          botParticipant = p;
          logger.debug(`[PERMS] Encontrado por teléfono: ${p.id}`);
          break;
        }

        if (p.id.includes(botPhone)) {
          botParticipant = p;
          logger.debug(`[PERMS] Encontrado por include teléfono: ${p.id}`);
          break;
        }

        if (botLid && p.id === botLid) {
          botParticipant = p;
          logger.debug(`[PERMS] Encontrado por LID exacto: ${p.id}`);
          break;
        }

        if (botLid && p.id.includes(botLid.split('@')[0])) {
          botParticipant = p;
          logger.debug(`[PERMS] Encontrado por include LID: ${p.id}`);
          break;
        }

        if (p.lid && botLid && p.lid === botLid) {
          botParticipant = p;
          logger.debug(`[PERMS] Encontrado por LID del participante: ${p.id}`);
          break;
        }

        if (p.lid && botLid && p.lid.includes(botLid.split('@')[0])) {
          botParticipant = p;
          logger.debug(`[PERMS] Encontrado por include LID del participante: ${p.id}`);
          break;
        }
      }

      if (!botParticipant) {
        const allIds = metadata.participants.map(p => p.id).join(', ');
        logger.debug(
          `[PERMS] Bot no encontrado en grupo. Buscando: ${botPhone}, LID: ${botLid}. Participantes: ${allIds.substring(0, 500)}`,
        );
        return { isAdmin: false, isSuperAdmin: false };
      }

      const isAdmin = botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin';
      logger.debug(
        `[PERMS] Bot encontrado! JID: ${botParticipant.id}, Admin: ${botParticipant.admin}, LID: ${botParticipant.lid}, isAdmin: ${isAdmin}`,
      );

      return {
        isAdmin,
        isSuperAdmin: botParticipant.admin === 'superadmin',
      };
    } catch (error) {
      logError('Error obteniendo permisos del bot:', error);
      return { isAdmin: false, isSuperAdmin: false };
    }
  }

  static async canBotModerate(sock: WASocket, groupJid: string): Promise<boolean> {
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

  static async getGroupAdmins(sock: WASocket, groupJid: string): Promise<string[]> {
    try {
      const metadata = await this.getGroupMetadata(sock, groupJid);
      if (!metadata) return [];
      return metadata.participants
        .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
        .map(p => p.id);
    } catch (error) {
      logError('Error obteniendo administradores:', error);
      return [];
    }
  }

  static async isUserInGroup(sock: WASocket, groupJid: string, userJid: string): Promise<boolean> {
    try {
      const metadata = await this.getGroupMetadata(sock, groupJid);
      if (!metadata) return false;

      if (isLidJid(userJid)) {
        return metadata.participants.some(p => normalizeJid(p.id) === normalizeJid(userJid));
      }

      const userPhone = userJid.split('@')[0].split(':')[0];
      const participant = await this.findParticipantByPhone(sock, metadata.participants, userPhone);
      return participant !== null;
    } catch (error) {
      logError('Error verificando participante:', error);
      return false;
    }
  }
}
