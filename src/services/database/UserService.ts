import type { IDatabase } from "./Database.js";

export interface User {
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
  createdAt: number;
  updatedAt: number;
}

export class UserService {
  private readonly COLLECTION = "users";

  constructor(private db: IDatabase) {}

  async getUser(jid: string): Promise<User> {
    const existing = await this.db.get<User>(this.COLLECTION, jid);

    if (existing) {
      return existing;
    }

    const newUser: User = {
      jid,
      name: "User",
      isOwner: false,
      isBanned: false,
      level: 1,
      xp: 0,
      money: 0,
      totalCommands: 0,
      warnings: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.db.set(this.COLLECTION, jid, newUser);
    return newUser;
  }

  async updateUser(jid: string, updates: Partial<User>): Promise<void> {
    await this.db.update<User>(this.COLLECTION, jid, {
      ...updates,
      updatedAt: Date.now(),
    });
  }

  async addXP(jid: string, amount: number): Promise<User> {
    const user = await this.getUser(jid);
    const newXP = user.xp + amount;
    const newLevel = this.calculateLevel(newXP);

    await this.updateUser(jid, {
      xp: newXP,
      level: newLevel,
    });

    return { ...user, xp: newXP, level: newLevel };
  }

  async addMoney(jid: string, amount: number): Promise<void> {
    const user = await this.getUser(jid);
    await this.updateUser(jid, {
      money: user.money + amount,
    });
  }

  async removeMoney(jid: string, amount: number): Promise<boolean> {
    const user = await this.getUser(jid);

    if (user.money < amount) {
      return false;
    }

    await this.updateUser(jid, {
      money: user.money - amount,
    });

    return true;
  }

  async incrementCommands(jid: string): Promise<void> {
    const user = await this.getUser(jid);
    await this.updateUser(jid, {
      totalCommands: user.totalCommands + 1,
    });
  }

  async banUser(jid: string, reason?: string): Promise<void> {
    await this.updateUser(jid, {
      isBanned: true,
    });
  }

  async unbanUser(jid: string): Promise<void> {
    await this.updateUser(jid, {
      isBanned: false,
      warnings: 0,
    });
  }

  async addWarning(jid: string): Promise<number> {
    const user = await this.getUser(jid);
    const newWarnings = user.warnings + 1;

    await this.updateUser(jid, {
      warnings: newWarnings,
    });

    if (newWarnings >= 3) {
      await this.banUser(jid, "Acumulación de 3 advertencias");
    }

    return newWarnings;
  }

  async getAllUsers(): Promise<User[]> {
    return await this.db.getAll<User>(this.COLLECTION);
  }

  async getTopByXP(limit: number = 10): Promise<User[]> {
    const users = await this.getAllUsers();
    return users.sort((a, b) => b.xp - a.xp).slice(0, limit);
  }

  async getTopByMoney(limit: number = 10): Promise<User[]> {
    const users = await this.getAllUsers();
    return users.sort((a, b) => b.money - a.money).slice(0, limit);
  }

  async getTopByLevel(limit: number = 10): Promise<User[]> {
    const users = await this.getAllUsers();
    return users.sort((a, b) => b.level - a.level).slice(0, limit);
  }

  private calculateLevel(xp: number): number {
    return Math.floor(Math.sqrt(xp / 100)) + 1;
  }

  getRequiredXPForNextLevel(level: number): number {
    return level ** 2 * 100;
  }
}
