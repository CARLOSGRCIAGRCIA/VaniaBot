export interface IGroup {
  jid: string;
  name: string;
  isActive: boolean;
  settings: {
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
  };
  stats: {
    totalMessages: number;
    totalCommands: number;
  };
  createdAt: number;
  updatedAt: number;
}

export class Group implements IGroup {
  jid: string;
  name: string;
  isActive: boolean;
  settings: IGroup["settings"];
  stats: IGroup["stats"];
  createdAt: number;
  updatedAt: number;

  constructor(data: Partial<IGroup> & { jid: string }) {
    this.jid = data.jid;
    this.name = data.name || "Group";
    this.isActive = data.isActive !== undefined ? data.isActive : true;

    this.settings = {
      welcome: data.settings?.welcome || { enabled: false },
      goodbye: data.settings?.goodbye || { enabled: false },
      antiSpam: data.settings?.antiSpam || {
        enabled: true,
        maxMessages: 10,
        timeWindow: 60,
      },
      antiLink: data.settings?.antiLink || {
        enabled: false,
        allowedDomains: [],
      },
      antiWords: data.settings?.antiWords || {
        enabled: false,
        words: [],
      },
      levels: data.settings?.levels || {
        enabled: true,
        announceOnLevelUp: true,
      },
      economy: data.settings?.economy || {
        enabled: true,
      },
      autoMod: data.settings?.autoMod || {
        enabled: false,
        deleteLinks: false,
        deleteBadWords: false,
        warnOnViolation: true,
      },
    };

    this.stats = data.stats || {
      totalMessages: 0,
      totalCommands: 0,
    };

    this.createdAt = data.createdAt || Date.now();
    this.updatedAt = data.updatedAt || Date.now();
  }

  setWelcome(enabled: boolean, message?: string): void {
    this.settings.welcome = { enabled, message };
    this.updatedAt = Date.now();
  }

  setGoodbye(enabled: boolean, message?: string): void {
    this.settings.goodbye = { enabled, message };
    this.updatedAt = Date.now();
  }

  toggleAntiSpam(enabled: boolean): void {
    this.settings.antiSpam.enabled = enabled;
    this.updatedAt = Date.now();
  }

  toggleAntiLink(enabled: boolean): void {
    this.settings.antiLink.enabled = enabled;
    this.updatedAt = Date.now();
  }

  addAllowedDomain(domain: string): void {
    if (!this.settings.antiLink.allowedDomains.includes(domain)) {
      this.settings.antiLink.allowedDomains.push(domain);
      this.updatedAt = Date.now();
    }
  }

  removeAllowedDomain(domain: string): boolean {
    const index = this.settings.antiLink.allowedDomains.indexOf(domain);
    if (index > -1) {
      this.settings.antiLink.allowedDomains.splice(index, 1);
      this.updatedAt = Date.now();
      return true;
    }
    return false;
  }

  addBadWord(word: string): void {
    const lowerWord = word.toLowerCase();
    if (!this.settings.antiWords.words.includes(lowerWord)) {
      this.settings.antiWords.words.push(lowerWord);
      this.updatedAt = Date.now();
    }
  }

  removeBadWord(word: string): boolean {
    const lowerWord = word.toLowerCase();
    const index = this.settings.antiWords.words.indexOf(lowerWord);
    if (index > -1) {
      this.settings.antiWords.words.splice(index, 1);
      this.updatedAt = Date.now();
      return true;
    }
    return false;
  }

  hasBadWords(text: string): boolean {
    if (!this.settings.antiWords.enabled) return false;

    const lowerText = text.toLowerCase();
    return this.settings.antiWords.words.some((word) =>
      lowerText.includes(word),
    );
  }

  hasLinks(text: string): boolean {
    if (!this.settings.antiLink.enabled) return false;

    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const matches = text.match(urlRegex);

    if (!matches) return false;

    if (this.settings.antiLink.allowedDomains.length === 0) {
      return true;
    }

    return matches.some((url) => {
      try {
        const domain = new URL(url).hostname;
        return !this.settings.antiLink.allowedDomains.some((allowed) =>
          domain.includes(allowed),
        );
      } catch {
        return true;
      }
    });
  }

  incrementMessages(): void {
    this.stats.totalMessages++;
    this.updatedAt = Date.now();
  }

  incrementCommands(): void {
    this.stats.totalCommands++;
    this.updatedAt = Date.now();
  }

  toJSON(): IGroup {
    return {
      jid: this.jid,
      name: this.name,
      isActive: this.isActive,
      settings: this.settings,
      stats: this.stats,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
