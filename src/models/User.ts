export interface IUser {
  jid: string;
  name: string;
  isOwner: boolean;
  isBanned: boolean;
  level: number;
  xp: number;
  money: number;
  lastDaily?: number;
  lastWeekly?: number;
  lastMonthly?: number;
  totalCommands: number;
  warnings: number;
  inventory?: string[];
  achievements?: string[];
  createdAt: number;
  updatedAt: number;
}

export class User implements IUser {
  jid: string;
  name: string;
  isOwner: boolean;
  isBanned: boolean;
  level: number;
  xp: number;
  money: number;
  lastDaily?: number;
  lastWeekly?: number;
  lastMonthly?: number;
  totalCommands: number;
  warnings: number;
  inventory: string[];
  achievements: string[];
  createdAt: number;
  updatedAt: number;

  constructor(data: Partial<IUser> & { jid: string }) {
    this.jid = data.jid;
    this.name = data.name || "User";
    this.isOwner = data.isOwner || false;
    this.isBanned = data.isBanned || false;
    this.level = data.level || 1;
    this.xp = data.xp || 0;
    this.money = data.money || 0;
    this.lastDaily = data.lastDaily;
    this.lastWeekly = data.lastWeekly;
    this.lastMonthly = data.lastMonthly;
    this.totalCommands = data.totalCommands || 0;
    this.warnings = data.warnings || 0;
    this.inventory = data.inventory || [];
    this.achievements = data.achievements || [];
    this.createdAt = data.createdAt || Date.now();
    this.updatedAt = data.updatedAt || Date.now();
  }

  canClaimDaily(): boolean {
    if (!this.lastDaily) return true;
    const oneDayMs = 24 * 60 * 60 * 1000;
    return Date.now() - this.lastDaily >= oneDayMs;
  }

  canClaimWeekly(): boolean {
    if (!this.lastWeekly) return true;
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - this.lastWeekly >= oneWeekMs;
  }

  canClaimMonthly(): boolean {
    if (!this.lastMonthly) return true;
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
    return Date.now() - this.lastMonthly >= oneMonthMs;
  }

  getDailyTimeRemaining(): number {
    if (!this.lastDaily) return 0;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const remaining = this.lastDaily + oneDayMs - Date.now();
    return Math.max(0, remaining);
  }

  addItem(item: string): void {
    if (!this.inventory.includes(item)) {
      this.inventory.push(item);
      this.updatedAt = Date.now();
    }
  }

  removeItem(item: string): boolean {
    const index = this.inventory.indexOf(item);
    if (index > -1) {
      this.inventory.splice(index, 1);
      this.updatedAt = Date.now();
      return true;
    }
    return false;
  }

  hasItem(item: string): boolean {
    return this.inventory.includes(item);
  }

  addAchievement(achievement: string): boolean {
    if (!this.achievements.includes(achievement)) {
      this.achievements.push(achievement);
      this.updatedAt = Date.now();
      return true;
    }
    return false;
  }

  hasAchievement(achievement: string): boolean {
    return this.achievements.includes(achievement);
  }

  toJSON(): IUser {
    return {
      jid: this.jid,
      name: this.name,
      isOwner: this.isOwner,
      isBanned: this.isBanned,
      level: this.level,
      xp: this.xp,
      money: this.money,
      lastDaily: this.lastDaily,
      lastWeekly: this.lastWeekly,
      lastMonthly: this.lastMonthly,
      totalCommands: this.totalCommands,
      warnings: this.warnings,
      inventory: this.inventory,
      achievements: this.achievements,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
