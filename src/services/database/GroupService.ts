import type { IDatabase } from "./Database.js";

export interface GroupSettings {
  jid: string;
  name: string;
  isActive: boolean;

  welcome: {
    enabled: boolean;
    message?: string;
  };

  goodbye: {
    enabled: boolean;
    message?: string;
  };

  antiSpam: {
    enabled: boolean;
    maxMessages: number;
    timeWindow: number;
  };

  antiLink: {
    enabled: boolean;
    allowedDomains: string[];
  };

  antiWords: {
    enabled: boolean;
    words: string[];
  };

  levels: {
    enabled: boolean;
    announceOnLevelUp: boolean;
  };

  economy: {
    enabled: boolean;
  };

  autoMod: {
    enabled: boolean;
    deleteLinks: boolean;
    deleteBadWords: boolean;
    warnOnViolation: boolean;
  };

  stats: {
    totalMessages: number;
    totalCommands: number;
  };

  createdAt: number;
  updatedAt: number;
}

export class GroupService {
  private readonly COLLECTION = "groups";

  constructor(private db: IDatabase) {}

  async getGroup(jid: string): Promise<GroupSettings> {
    const existing = await this.db.get<GroupSettings>(this.COLLECTION, jid);

    if (existing) {
      return existing;
    }

    const newGroup: GroupSettings = {
      jid,
      name: "Group",
      isActive: true,
      welcome: {
        enabled: false,
      },
      goodbye: {
        enabled: false,
      },
      antiSpam: {
        enabled: true,
        maxMessages: 10,
        timeWindow: 60,
      },
      antiLink: {
        enabled: false,
        allowedDomains: [],
      },
      antiWords: {
        enabled: false,
        words: [],
      },
      levels: {
        enabled: true,
        announceOnLevelUp: true,
      },
      economy: {
        enabled: true,
      },
      autoMod: {
        enabled: false,
        deleteLinks: false,
        deleteBadWords: false,
        warnOnViolation: true,
      },
      stats: {
        totalMessages: 0,
        totalCommands: 0,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.db.set(this.COLLECTION, jid, newGroup);
    return newGroup;
  }

  async updateGroup(
    jid: string,
    updates: Partial<GroupSettings>,
  ): Promise<void> {
    await this.db.update<GroupSettings>(this.COLLECTION, jid, {
      ...updates,
      updatedAt: Date.now(),
    });
  }

  async setWelcome(
    jid: string,
    enabled: boolean,
    message?: string,
  ): Promise<void> {
    await this.updateGroup(jid, {
      welcome: { enabled, message },
    });
  }

  async setGoodbye(
    jid: string,
    enabled: boolean,
    message?: string,
  ): Promise<void> {
    await this.updateGroup(jid, {
      goodbye: { enabled, message },
    });
  }

  async toggleAntiSpam(jid: string, enabled: boolean): Promise<void> {
    const group = await this.getGroup(jid);
    await this.updateGroup(jid, {
      antiSpam: { ...group.antiSpam, enabled },
    });
  }

  async toggleAntiLink(jid: string, enabled: boolean): Promise<void> {
    const group = await this.getGroup(jid);
    await this.updateGroup(jid, {
      antiLink: { ...group.antiLink, enabled },
    });
  }

  async addAllowedDomain(jid: string, domain: string): Promise<void> {
    const group = await this.getGroup(jid);
    const domains = [...group.antiLink.allowedDomains, domain];

    await this.updateGroup(jid, {
      antiLink: { ...group.antiLink, allowedDomains: domains },
    });
  }

  async removeAllowedDomain(jid: string, domain: string): Promise<void> {
    const group = await this.getGroup(jid);
    const domains = group.antiLink.allowedDomains.filter((d) => d !== domain);

    await this.updateGroup(jid, {
      antiLink: { ...group.antiLink, allowedDomains: domains },
    });
  }

  async addBadWord(jid: string, word: string): Promise<void> {
    const group = await this.getGroup(jid);
    const words = [...group.antiWords.words, word.toLowerCase()];

    await this.updateGroup(jid, {
      antiWords: { ...group.antiWords, words },
    });
  }

  async removeBadWord(jid: string, word: string): Promise<void> {
    const group = await this.getGroup(jid);
    const words = group.antiWords.words.filter((w) => w !== word.toLowerCase());

    await this.updateGroup(jid, {
      antiWords: { ...group.antiWords, words },
    });
  }

  async incrementMessageCount(jid: string): Promise<void> {
    const group = await this.getGroup(jid);
    await this.updateGroup(jid, {
      stats: {
        ...group.stats,
        totalMessages: group.stats.totalMessages + 1,
      },
    });
  }

  async incrementCommandCount(jid: string): Promise<void> {
    const group = await this.getGroup(jid);
    await this.updateGroup(jid, {
      stats: {
        ...group.stats,
        totalCommands: group.stats.totalCommands + 1,
      },
    });
  }

  async getAllGroups(): Promise<GroupSettings[]> {
    return await this.db.getAll<GroupSettings>(this.COLLECTION);
  }

  async getActiveGroups(): Promise<GroupSettings[]> {
    return await this.db.find<GroupSettings>(this.COLLECTION, {
      isActive: true,
    });
  }

  async deactivateGroup(jid: string): Promise<void> {
    await this.updateGroup(jid, { isActive: false });
  }

  async activateGroup(jid: string): Promise<void> {
    await this.updateGroup(jid, { isActive: true });
  }
}
