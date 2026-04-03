import fs from 'fs';
import path from 'path';

export interface AntiCallConfig {
  enabled: boolean;
  blockedUsers: string[];
}

export class AntiCallService {
  private static instance: AntiCallService;
  private config: AntiCallConfig = { enabled: false, blockedUsers: [] };
  private readonly CONFIG_PATH = path.join(process.cwd(), 'data', 'anticall.json');

  constructor() {
    this.loadConfig();
  }

  static getInstance(): AntiCallService {
    if (!AntiCallService.instance) {
      AntiCallService.instance = new AntiCallService();
    }
    return AntiCallService.instance;
  }

  private loadConfig(): void {
    try {
      if (fs.existsSync(this.CONFIG_PATH)) {
        this.config = JSON.parse(fs.readFileSync(this.CONFIG_PATH, 'utf-8'));
      }
    } catch {
      this.config = { enabled: false, blockedUsers: [] };
    }
  }

  private saveConfig(): void {
    const dataDir = path.dirname(this.CONFIG_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(this.CONFIG_PATH, JSON.stringify(this.config, null, 2));
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  enable(): void {
    this.config.enabled = true;
    this.saveConfig();
  }

  disable(): void {
    this.config.enabled = false;
    this.saveConfig();
  }

  getConfig(): AntiCallConfig {
    return this.config;
  }

  shouldBlock(callerJid: string): boolean {
    return this.config.blockedUsers.includes(callerJid);
  }

  blockUser(userJid: string): void {
    if (!this.config.blockedUsers.includes(userJid)) {
      this.config.blockedUsers.push(userJid);
      this.saveConfig();
    }
  }

  unblockUser(userJid: string): void {
    const index = this.config.blockedUsers.indexOf(userJid);
    if (index > -1) {
      this.config.blockedUsers.splice(index, 1);
      this.saveConfig();
    }
  }

  getBlockedUsers(): string[] {
    return this.config.blockedUsers;
  }
}

export const antiCallService = AntiCallService.getInstance();
