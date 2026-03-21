import type { WASocket, GroupParticipant } from '@whiskeysockets/baileys';
import { logError, logger } from '@/utils/logger.js';
import { normalizeJid, getBotPhone, getBotLid, extractPhone } from './JidService.js';
import { GroupMetadataCache } from './GroupMetadataCache.js';

export interface BotPermissions {
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export class BotPermissionChecker {
  static async getPermissions(sock: WASocket, groupJid: string): Promise<BotPermissions> {
    try {
      let metadata = await GroupMetadataCache.fetch(sock, groupJid);

      if (!metadata || metadata.participants.length === 0) {
        GroupMetadataCache.invalidate(groupJid);
        metadata = await sock.groupMetadata(groupJid);
      }

      if (!metadata) return { isAdmin: false, isSuperAdmin: false };

      const botId = sock.user?.id;
      if (!botId) {
        logger.debug('[PERMS] Bot has no user ID');
        return { isAdmin: false, isSuperAdmin: false };
      }

      const botPhone = getBotPhone(sock);
      const botJidNormalized = normalizeJid(botId);
      const botLid = getBotLid(sock);

      logger.debug(`[PERMS] Searching bot - ID: ${botId}, Phone: ${botPhone}, LID: ${botLid}`);
      logger.debug(`[PERMS] Total participants: ${metadata.participants.length}`);

      const botParticipant = this.findBotParticipant(metadata.participants, {
        botId,
        botPhone,
        botJidNormalized,
        botLid,
      });

      if (!botParticipant) {
        const allIds = metadata.participants.map(p => p.id).join(', ');
        logger.debug(
          `[PERMS] Bot not found in group. Searching: ${botPhone}, LID: ${botLid}. Participants: ${allIds.substring(0, 500)}`,
        );
        return { isAdmin: false, isSuperAdmin: false };
      }

      const isAdmin = botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin';
      logger.debug(
        `[PERMS] Bot found! JID: ${botParticipant.id}, Admin: ${botParticipant.admin}, LID: ${botParticipant.lid}, isAdmin: ${isAdmin}`,
      );

      return {
        isAdmin,
        isSuperAdmin: botParticipant.admin === 'superadmin',
      };
    } catch (error) {
      logError('Error getting bot permissions:', error);
      return { isAdmin: false, isSuperAdmin: false };
    }
  }

  private static findBotParticipant(
    participants: GroupParticipant[],
    bot: { botId: string; botPhone: string; botJidNormalized: string; botLid: string | null },
  ): GroupParticipant | undefined {
    for (const p of participants) {
      const pNormalized = normalizeJid(p.id);

      if (pNormalized === bot.botJidNormalized) {
        logger.debug(`[PERMS] Found by normalized JID: ${p.id}`);
        return p;
      }

      const pPhone = extractPhone(p.id);
      if (pPhone === bot.botPhone) {
        logger.debug(`[PERMS] Found by phone: ${p.id}`);
        return p;
      }

      if (p.id.includes(bot.botPhone)) {
        logger.debug(`[PERMS] Found by phone include: ${p.id}`);
        return p;
      }

      if (bot.botLid && p.id === bot.botLid) {
        logger.debug(`[PERMS] Found by exact LID: ${p.id}`);
        return p;
      }

      if (bot.botLid && p.id.includes(bot.botLid.split('@')[0])) {
        logger.debug(`[PERMS] Found by LID include: ${p.id}`);
        return p;
      }

      if (p.lid && bot.botLid && p.lid === bot.botLid) {
        logger.debug(`[PERMS] Found by participant LID: ${p.id}`);
        return p;
      }

      if (p.lid && bot.botLid && p.lid.includes(bot.botLid.split('@')[0])) {
        logger.debug(`[PERMS] Found by participant LID include: ${p.id}`);
        return p;
      }
    }
    return undefined;
  }

  static async canModerate(sock: WASocket, groupJid: string): Promise<boolean> {
    const permissions = await this.getPermissions(sock, groupJid);
    return permissions.isAdmin;
  }
}
