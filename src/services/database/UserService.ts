import type { IDatabase } from "./Database.js";
import { config } from "@/config/index.js";

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
  inventory: string[];
  achievements: string[];
  createdAt: number;
  updatedAt: number;
}

export class UserService {
  private readonly COLLECTION = "users";

  constructor(private db: IDatabase) {}

  private async isOwnerJidAsync(jid: string): Promise<boolean> {
    if (config.owners.includes(jid)) {
      return true;
    }

    const jidBase = jid.split("@")[0];
    if (config.owners.includes(jidBase)) {
      return true;
    }

    const inConfig = config.owners.some((owner) => {
      const cleanOwner = owner.split("@")[0];
      return jid.includes(cleanOwner) || jidBase === cleanOwner;
    });

    if (inConfig) {
      return true;
    }

    try {
      const existingUser = await this.db.get<User>(this.COLLECTION, jid);
      return existingUser?.isOwner || false;
    } catch {
      return false;
    }
  }

  private isOwnerJid(jid: string): boolean {
    if (config.owners.includes(jid)) {
      return true;
    }

    const jidBase = jid.split("@")[0];
    if (config.owners.includes(jidBase)) {
      return true;
    }

    const isOwner = config.owners.some((owner) => {
      const cleanOwner = owner.split("@")[0];
      return jid.includes(cleanOwner) || jidBase === cleanOwner;
    });

    return isOwner;
  }

  async getUser(jid: string): Promise<User> {
    const existing = await this.db.get<User>(this.COLLECTION, jid);

    const isOwnerFromConfig = this.isOwnerJid(jid);
    const isOwnerFromDB = existing?.isOwner || false;

    const isOwner = isOwnerFromConfig || isOwnerFromDB;

    if (existing) {
      const updatedUser = {
        ...existing,
        isOwner,
        inventory: existing.inventory || [],
        achievements: existing.achievements || [],
      };

      if (existing.isOwner !== isOwner) {
        await this.db.update<User>(this.COLLECTION, jid, { isOwner });
      }

      return updatedUser;
    }

    const newUser: User = {
      jid,
      name: "User",
      isOwner,
      isBanned: false,
      level: 1,
      xp: 0,
      money: 0,
      totalCommands: 0,
      warnings: 0,
      inventory: [],
      achievements: [],
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

    if (user.isOwner) {
      return user;
    }

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

    if (user.isOwner) {
      return true;
    }

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
    const user = await this.getUser(jid);

    if (user.isOwner) {
      throw new Error("No se puede banear a un owner");
    }

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

    if (user.isOwner) {
      return 0;
    }

    const newWarnings = user.warnings + 1;

    await this.updateUser(jid, {
      warnings: newWarnings,
    });

    if (newWarnings >= 3) {
      await this.banUser(jid, "Acumulación de 3 advertencias");
    }

    return newWarnings;
  }

  async addItem(jid: string, item: string): Promise<void> {
    const user = await this.getUser(jid);

    if (!user.inventory.includes(item)) {
      const newInventory = [...user.inventory, item];
      await this.updateUser(jid, {
        inventory: newInventory,
      });
    }
  }

  async removeItem(jid: string, item: string): Promise<boolean> {
    const user = await this.getUser(jid);
    const index = user.inventory.indexOf(item);

    if (index === -1) {
      return false;
    }

    const newInventory = [...user.inventory];
    newInventory.splice(index, 1);

    await this.updateUser(jid, {
      inventory: newInventory,
    });

    return true;
  }

  async hasItem(jid: string, item: string): Promise<boolean> {
    const user = await this.getUser(jid);
    return user.inventory.includes(item);
  }

  async addAchievement(jid: string, achievementId: string): Promise<boolean> {
    const user = await this.getUser(jid);

    if (user.isOwner) {
      return false;
    }

    if (user.achievements.includes(achievementId)) {
      return false;
    }

    const newAchievements = [...user.achievements, achievementId];
    await this.updateUser(jid, {
      achievements: newAchievements,
    });

    return true;
  }

  async hasAchievement(jid: string, achievementId: string): Promise<boolean> {
    const user = await this.getUser(jid);

    if (user.isOwner) {
      return true;
    }

    return user.achievements.includes(achievementId);
  }

  async getAllUsers(): Promise<User[]> {
    return await this.db.getAll<User>(this.COLLECTION);
  }

  async getTopByXP(limit: number = 10): Promise<User[]> {
    const users = await this.getAllUsers();
    return users
      .filter((u) => !u.isOwner)
      .sort((a, b) => b.xp - a.xp)
      .slice(0, limit);
  }

  async getTopByMoney(limit: number = 10): Promise<User[]> {
    const users = await this.getAllUsers();
    return users
      .filter((u) => !u.isOwner)
      .sort((a, b) => b.money - a.money)
      .slice(0, limit);
  }

  async getTopByLevel(limit: number = 10): Promise<User[]> {
    const users = await this.getAllUsers();
    return users
      .filter((u) => !u.isOwner)
      .sort((a, b) => b.level - a.level)
      .slice(0, limit);
  }

  private calculateLevel(xp: number): number {
    return Math.floor(Math.sqrt(xp / 100)) + 1;
  }

  getRequiredXPForNextLevel(level: number): number {
    return level ** 2 * 100;
  }

  async setOwner(jid: string, isOwner: boolean): Promise<void> {
    await this.updateUser(jid, {
      isOwner,
    });

    if (isOwner) {
      await this.updateUser(jid, {
        isBanned: false,
        warnings: 0,
      });
    }
  }

  async grantMoney(
    fromJid: string,
    toJid: string,
    amount: number,
  ): Promise<boolean> {
    const fromUser = await this.getUser(fromJid);

    if (!fromUser.isOwner) {
      throw new Error("Solo los owners pueden conceder dinero");
    }

    await this.addMoney(toJid, amount);
    return true;
  }

  async grantXP(fromJid: string, toJid: string, amount: number): Promise<void> {
    const fromUser = await this.getUser(fromJid);

    if (!fromUser.isOwner) {
      throw new Error("Solo los owners pueden conceder XP");
    }

    await this.addXP(toJid, amount);
  }

  async grantItem(
    fromJid: string,
    toJid: string,
    item: string,
  ): Promise<boolean> {
    const fromUser = await this.getUser(fromJid);

    if (!fromUser.isOwner) {
      throw new Error("Solo los owners pueden conceder items");
    }

    await this.addItem(toJid, item);
    return true;
  }
}
