import type { IDatabase } from '../database/Database';

function normalizeJid(jid: string): string {
  if (!jid) return jid;
  if (jid.includes('@s.whatsapp.net')) {
    const phone = jid.split('@')[0].split(':')[0];
    return `${phone}@s.whatsapp.net`;
  }
  if (jid.includes('@lid')) {
    const phone = jid.split('@')[0];
    return `${phone}@lid`;
  }
  return jid;
}

export interface ModerationAction {
  userId: string;
  userName: string;
  action: 'ban' | 'kick' | 'mute' | 'warn';
  reason: string;
  moderator: string;
  timestamp: number;
  duration?: number;
  expiresAt?: number;
}

export interface BanRecord {
  userId: string;
  userName: string;
  bannedBy: string;
  reason: string;
  timestamp: number;
  groupId: string;
}

export interface MuteRecord {
  userId: string;
  userName: string;
  mutedBy: string;
  reason: string;
  timestamp: number;
  duration: number;
  expiresAt: number;
  groupId: string;
}

export class ModerationService {
  private db: IDatabase;
  private readonly BANS_COLLECTION = 'bans';
  private readonly MUTES_COLLECTION = 'mutes';
  private readonly MODERATION_LOG_COLLECTION = 'moderation_logs';

  constructor(db: IDatabase) {
    this.db = db;
  }

  async banUser(
    groupId: string,
    userId: string,
    userName: string,
    moderator: string,
    reason: string,
  ): Promise<void> {
    const normalizedGroupId = normalizeJid(groupId);
    const normalizedUserId = normalizeJid(userId);
    const banKey = `${normalizedGroupId}:${normalizedUserId}`;

    const banRecord: BanRecord = {
      userId: normalizedUserId,
      userName,
      bannedBy: moderator,
      reason,
      timestamp: Date.now(),
      groupId: normalizedGroupId,
    };

    await this.db.set(this.BANS_COLLECTION, banKey, banRecord);

    await this.logAction({
      userId: normalizedUserId,
      userName,
      action: 'ban',
      reason,
      moderator,
      timestamp: Date.now(),
    });
  }

  async unbanUser(groupId: string, userId: string): Promise<boolean> {
    const normalizedGroupId = normalizeJid(groupId);
    const normalizedUserId = normalizeJid(userId);
    const banKey = `${normalizedGroupId}:${normalizedUserId}`;
    const ban = await this.db.get<BanRecord>(this.BANS_COLLECTION, banKey);

    if (!ban) return false;

    await this.db.delete(this.BANS_COLLECTION, banKey);
    return true;
  }

  async isBanned(groupId: string, userId: string): Promise<boolean> {
    const normalizedGroupId = normalizeJid(groupId);
    const normalizedUserId = normalizeJid(userId);
    const banKey = `${normalizedGroupId}:${normalizedUserId}`;
    const ban = await this.db.get<BanRecord>(this.BANS_COLLECTION, banKey);
    return ban !== null;
  }

  async getBanInfo(groupId: string, userId: string): Promise<BanRecord | null> {
    const normalizedGroupId = normalizeJid(groupId);
    const normalizedUserId = normalizeJid(userId);
    const banKey = `${normalizedGroupId}:${normalizedUserId}`;
    return await this.db.get<BanRecord>(this.BANS_COLLECTION, banKey);
  }

  async getGroupBans(groupId: string): Promise<BanRecord[]> {
    const allBans = await this.db.getAll<BanRecord>(this.BANS_COLLECTION);
    return allBans.filter(ban => ban.groupId === groupId);
  }

  async muteUser(
    groupId: string,
    userId: string,
    userName: string,
    moderator: string,
    reason: string,
    duration: number,
  ): Promise<void> {
    const normalizedGroupId = normalizeJid(groupId);
    const normalizedUserId = normalizeJid(userId);
    const muteKey = `${normalizedGroupId}:${normalizedUserId}`;
    const now = Date.now();

    const muteRecord: MuteRecord = {
      userId: normalizedUserId,
      userName,
      mutedBy: moderator,
      reason,
      timestamp: now,
      duration,
      expiresAt: now + duration,
      groupId: normalizedGroupId,
    };

    await this.db.set(this.MUTES_COLLECTION, muteKey, muteRecord);

    await this.logAction({
      userId: normalizedUserId,
      userName,
      action: 'mute',
      reason,
      moderator,
      timestamp: now,
      duration,
      expiresAt: now + duration,
    });
  }

  async unmuteUser(groupId: string, userId: string): Promise<boolean> {
    const normalizedGroupId = normalizeJid(groupId);
    const normalizedUserId = normalizeJid(userId);
    const muteKey = `${normalizedGroupId}:${normalizedUserId}`;
    const mute = await this.db.get<MuteRecord>(this.MUTES_COLLECTION, muteKey);

    if (!mute) return false;

    await this.db.delete(this.MUTES_COLLECTION, muteKey);
    return true;
  }

  async isMuted(groupId: string, userId: string): Promise<boolean> {
    const normalizedGroupId = normalizeJid(groupId);
    const normalizedUserId = normalizeJid(userId);
    const muteKey = `${normalizedGroupId}:${normalizedUserId}`;
    const mute = await this.db.get<MuteRecord>(this.MUTES_COLLECTION, muteKey);

    if (!mute) return false;

    if (Date.now() > mute.expiresAt) {
      await this.unmuteUser(groupId, userId);
      return false;
    }

    return true;
  }

  async getMuteInfo(groupId: string, userId: string): Promise<MuteRecord | null> {
    const normalizedGroupId = normalizeJid(groupId);
    const normalizedUserId = normalizeJid(userId);
    const muteKey = `${normalizedGroupId}:${normalizedUserId}`;
    const mute = await this.db.get<MuteRecord>(this.MUTES_COLLECTION, muteKey);

    if (!mute) return null;

    if (Date.now() > mute.expiresAt) {
      await this.unmuteUser(groupId, userId);
      return null;
    }

    return mute;
  }

  async getMuteTimeRemaining(groupId: string, userId: string): Promise<number> {
    const mute = await this.getMuteInfo(groupId, userId);
    if (!mute) return 0;

    const remaining = mute.expiresAt - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  async logAction(action: ModerationAction): Promise<void> {
    const logKey = `${action.userId}:${Date.now()}`;
    await this.db.set(this.MODERATION_LOG_COLLECTION, logKey, action);
  }

  async getUserHistory(userId: string): Promise<ModerationAction[]> {
    const allLogs = await this.db.getAll<ModerationAction>(this.MODERATION_LOG_COLLECTION);
    return allLogs.filter(log => log.userId === userId).sort((a, b) => b.timestamp - a.timestamp);
  }

  async getRecentActions(limit: number = 50): Promise<ModerationAction[]> {
    const allLogs = await this.db.getAll<ModerationAction>(this.MODERATION_LOG_COLLECTION);
    return allLogs.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }
}
