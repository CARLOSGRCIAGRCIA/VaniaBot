import type { IDatabase } from '../database/Database';

export interface ToggleRecord {
  chatJid: string;
  enabled: boolean;
  enabledBy: string;
  enabledAt: number;
  disabledBy: string;
  disabledAt: number;
}

export class VaniaToggleService {
  private db: IDatabase;
  private readonly COLLECTION = 'vania_toggle';

  constructor(db: IDatabase) {
    this.db = db;
  }

  async isEnabled(chatJid: string): Promise<boolean> {
    const record = await this.db.get<ToggleRecord>(this.COLLECTION, this.normalizeJid(chatJid));

    if (!record) {
      return true;
    }

    return record.enabled;
  }

  async enable(chatJid: string, enabledBy: string): Promise<void> {
    const key = this.normalizeJid(chatJid);
    const existing = await this.db.get<ToggleRecord>(this.COLLECTION, key);

    const record: ToggleRecord = {
      chatJid: key,
      enabled: true,
      enabledBy,
      enabledAt: Date.now(),
      disabledBy: existing?.disabledBy || '',
      disabledAt: existing?.disabledAt || 0,
    };

    await this.db.set(this.COLLECTION, key, record);
    await this.db.flush();
  }

  async disable(chatJid: string, disabledBy: string): Promise<void> {
    const key = this.normalizeJid(chatJid);
    const existing = await this.db.get<ToggleRecord>(this.COLLECTION, key);

    const record: ToggleRecord = {
      chatJid: key,
      enabled: false,
      enabledBy: existing?.enabledBy || '',
      enabledAt: existing?.enabledAt || 0,
      disabledBy,
      disabledAt: Date.now(),
    };

    await this.db.set(this.COLLECTION, key, record);
    await this.db.flush();
  }

  async toggle(chatJid: string, toggledBy: string): Promise<boolean> {
    const isCurrentlyEnabled = await this.isEnabled(chatJid);

    if (isCurrentlyEnabled) {
      await this.disable(chatJid, toggledBy);
    } else {
      await this.enable(chatJid, toggledBy);
    }
    return !isCurrentlyEnabled;
  }

  async getStatus(chatJid: string): Promise<{ enabled: boolean; record: ToggleRecord | null }> {
    const record = await this.db.get<ToggleRecord>(this.COLLECTION, this.normalizeJid(chatJid));
    return {
      enabled: record?.enabled ?? true,
      record,
    };
  }

  private normalizeJid(jid: string): string {
    return jid.split('@')[0].split(':')[0] + '@s.whatsapp.net';
  }
}
