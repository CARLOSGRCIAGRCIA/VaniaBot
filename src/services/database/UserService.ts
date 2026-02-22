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
  weeklyStreak?: number;
  totalCommands: number;
  warnings: number;
  inventory: Array<{
    itemId: string;
    name: string;
    type: string;
    purchasedAt: number;
    expiresAt?: number;
  }>;
  achievements: string[];
  createdAt: number;
  updatedAt: number;
}

export class UserService {
  private readonly COLLECTION = "users";
  private readonly OWNER_MONEY = 999999999;
  private readonly OWNER_LEVEL = 999;
  private readonly OWNER_XP = 999999;

  constructor(private db: IDatabase) { }

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
      if (isOwner && !existing.isOwner) {
        await this.promoteToOwner(jid);
        return (await this.db.get<User>(this.COLLECTION, jid)) as User;
      }

      if (isOwner && existing.money !== this.OWNER_MONEY) {
        await this.db.update<User>(this.COLLECTION, jid, {
          isOwner: true,
          money: this.OWNER_MONEY,
          level: this.OWNER_LEVEL,
          xp: this.OWNER_XP,
        });
      }

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
      level: isOwner ? this.OWNER_LEVEL : 1,
      xp: isOwner ? this.OWNER_XP : 0,
      money: isOwner ? this.OWNER_MONEY : 0,
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

  private async promoteToOwner(jid: string): Promise<void> {
    const user = await this.db.get<User>(this.COLLECTION, jid);
    if (!user) return;

    await this.db.update<User>(this.COLLECTION, jid, {
      isOwner: true,
      money: this.OWNER_MONEY,
      level: this.OWNER_LEVEL,
      xp: this.OWNER_XP,
      isBanned: false,
      warnings: 0,
    });
  }

  private async demoteFromOwner(jid: string): Promise<void> {
    const user = await this.db.get<User>(this.COLLECTION, jid);
    if (!user) return;

    await this.db.update<User>(this.COLLECTION, jid, {
      isOwner: false,
      money: 0,
      level: 1,
      xp: 0,
      warnings: 0,
      isBanned: false,
    });
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
      await this.updateUser(jid, {
        level: this.OWNER_LEVEL,
        xp: this.OWNER_XP,
      });
      return { ...user, level: this.OWNER_LEVEL, xp: this.OWNER_XP };
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

    if (user.isOwner) {
      await this.updateUser(jid, {
        money: this.OWNER_MONEY,
      });
      return;
    }

    await this.updateUser(jid, {
      money: user.money + amount,
    });
  }

  async removeMoney(jid: string, amount: number): Promise<boolean> {
    const user = await this.getUser(jid);

    if (user.isOwner) {
      await this.updateUser(jid, {
        money: this.OWNER_MONEY,
      });
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
      throw new Error("Cannot ban an owner");
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
      await this.banUser(jid, "Accumulated 3 warnings");
    }

    return newWarnings;
  }

  async addItem(jid: string, itemId: string): Promise<void> {
    const user = await this.getUser(jid);

    const exists = user.inventory.some((i) => i.itemId === itemId);

    if (!exists) {
      const newItem = {
        itemId,
        name: itemId,
        type: "legacy",
        purchasedAt: Date.now(),
      };

      const newInventory = [...user.inventory, newItem];

      await this.updateUser(jid, {
        inventory: newInventory,
      });
    }
  }


  async removeItem(jid: string, itemId: string): Promise<boolean> {
    const user = await this.getUser(jid);

    const index = user.inventory.findIndex((i) => i.itemId === itemId);

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

  async hasItem(jid: string, itemId: string): Promise<boolean> {
    const user = await this.getUser(jid);
    return user.inventory.some((i) => i.itemId === itemId);
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
    if (isOwner) {
      await this.promoteToOwner(jid);
    } else {
      await this.demoteFromOwner(jid);
    }
  }

  async grantMoney(
    fromJid: string,
    toJid: string,
    amount: number,
  ): Promise<boolean> {
    const fromUser = await this.getUser(fromJid);

    if (!fromUser.isOwner) {
      throw new Error("Only owners can grant money");
    }

    await this.addMoney(toJid, amount);
    return true;
  }

  async grantXP(fromJid: string, toJid: string, amount: number): Promise<void> {
    const fromUser = await this.getUser(fromJid);

    if (!fromUser.isOwner) {
      throw new Error("Only owners can grant XP");
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
      throw new Error("Only owners can grant items");
    }

    await this.addItem(toJid, item);
    return true;
  }

  canClaimDaily(user: User): boolean {
    if (user.isOwner) return true;
    if (!user.lastDaily) return true;
    const oneDayMs = 24 * 60 * 60 * 1000;
    return Date.now() - user.lastDaily >= oneDayMs;
  }

  canClaimWeekly(user: User): boolean {
    if (user.isOwner) return true;
    if (!user.lastWeekly) return true;
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - user.lastWeekly >= oneWeekMs;
  }

  canClaimMonthly(user: User): boolean {
    if (user.isOwner) return true;
    if (!user.lastMonthly) return true;
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
    return Date.now() - user.lastMonthly >= oneMonthMs;
  }

  getDailyTimeRemaining(user: User): number {
    if (!user.lastDaily) return 0;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const remaining = user.lastDaily + oneDayMs - Date.now();
    return Math.max(0, remaining);
  }

  getOwnerStats() {
    return {
      money: this.OWNER_MONEY,
      level: this.OWNER_LEVEL,
      xp: this.OWNER_XP,
    };
  }

  async addItemToInventory(
    jid: string,
    item: {
      itemId: string;
      name: string;
      type: string;
      purchasedAt: number;
      expiresAt?: number;
    }
  ): Promise<void> {
    const user = await this.getUser(jid);

    const newInventory = [...user.inventory, item];

    await this.db.update<User>(this.COLLECTION, jid, {
      inventory: newInventory,
    });
  }

  getWeeklyTimeRemaining(user: User): number {
    if (!user.lastWeekly) return 0;

    const weekInMs = 7 * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - user.lastWeekly;
    return Math.max(0, weekInMs - elapsed);
  }

  async updateWeeklyClaim(jid: string, streak: number): Promise<void> {
    await this.db.update<User>(this.COLLECTION, jid, {
      lastWeekly: Date.now(),
      weeklyStreak: streak,
    });
  }
}
