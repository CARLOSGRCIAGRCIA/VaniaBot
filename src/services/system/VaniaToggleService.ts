import type { IDatabase } from '../database/Database';

export interface ToggleRecord {
  key: string;
  chatJid: string;
  botId: string;
  enabled: boolean;
  enabledBy: string;
  enabledAt: number;
  disabledBy: string;
  disabledAt: number;
}

export class VaniaToggleService {
  private db!: IDatabase;
  private readonly COLLECTION = 'vania_toggle';

  setDatabase(db: IDatabase): void {
    this.db = db;
  }

  private normalizeJid(jid: string): string {
    return jid.split('@')[0].split(':')[0] + '@s.whatsapp.net';
  }

  private makeKey(chatJid: string, botId: string): string {
    return `${this.normalizeJid(chatJid)}|${botId}`;
  }

  isEnabledSync(_chatJid: string): boolean {
    return false;
  }

  async isEnabled(chatJid: string, botId: string = 'main'): Promise<boolean> {
    const key = this.makeKey(chatJid, botId);
    const record = await this.db.get<ToggleRecord>(this.COLLECTION, key);
    if (!record) {
      return false;
    }
    return record.enabled;
  }

  async enable(chatJid: string, enabledBy: string, botId: string = 'main'): Promise<void> {
    const key = this.makeKey(chatJid, botId);
    const normalizedJid = this.normalizeJid(chatJid);
    const existing = await this.db.get<ToggleRecord>(this.COLLECTION, key);

    const record: ToggleRecord = {
      key,
      chatJid: normalizedJid,
      botId,
      enabled: true,
      enabledBy,
      enabledAt: Date.now(),
      disabledBy: existing?.disabledBy || '',
      disabledAt: existing?.disabledAt || 0,
    };

    await this.db.set(this.COLLECTION, key, record);
    await this.db.flush();
  }

  async disable(chatJid: string, disabledBy: string, botId: string = 'main'): Promise<void> {
    const key = this.makeKey(chatJid, botId);
    const normalizedJid = this.normalizeJid(chatJid);
    const existing = await this.db.get<ToggleRecord>(this.COLLECTION, key);

    const record: ToggleRecord = {
      key,
      chatJid: normalizedJid,
      botId,
      enabled: false,
      enabledBy: existing?.enabledBy || '',
      enabledAt: existing?.enabledAt || 0,
      disabledBy,
      disabledAt: Date.now(),
    };

    await this.db.set(this.COLLECTION, key, record);
    await this.db.flush();
  }

  async toggle(chatJid: string, toggledBy: string, botId: string = 'main'): Promise<boolean> {
    const isCurrentlyEnabled = await this.isEnabled(chatJid, botId);

    if (isCurrentlyEnabled) {
      await this.disable(chatJid, toggledBy, botId);
    } else {
      await this.enable(chatJid, toggledBy, botId);
    }
    return !isCurrentlyEnabled;
  }

  async getStatus(
    chatJid: string,
    botId: string = 'main',
  ): Promise<{ enabled: boolean; record: ToggleRecord | null }> {
    const key = this.makeKey(chatJid, botId);
    const record = await this.db.get<ToggleRecord>(this.COLLECTION, key);
    return {
      enabled: record?.enabled ?? false,
      record,
    };
  }

  async getBotsStatus(
    chatJid: string,
  ): Promise<{ main: boolean; subbots: Record<string, boolean> }> {
    const normalizedJid = this.normalizeJid(chatJid);

    const mainKey = this.makeKey(normalizedJid, 'main');
    const mainRecord = await this.db.get<ToggleRecord>(this.COLLECTION, mainKey);

    const allKeys = await this.db.keys(this.COLLECTION);
    const subbots: Record<string, boolean> = {};

    for (const key of allKeys) {
      if (key.startsWith(normalizedJid + '|') && key !== mainKey) {
        const botId = key.split('|')[1];
        const record = await this.db.get<ToggleRecord>(this.COLLECTION, key);
        if (record) {
          subbots[botId] = record.enabled;
        }
      }
    }

    return {
      main: mainRecord?.enabled ?? false,
      subbots,
    };
  }
}
