import type { IDatabase } from './Database.js';
import { config } from '@/config/index.js';

export interface RPGStats {
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  stamina: number;
  maxStamina: number;
  atk: number;
  def: number;
  str: number;
  int: number;
  agi: number;
  vit: number;
  luck: number;
  critChance: number;
  dodgeChance: number;
}

export interface InventoryItem {
  itemId: string;
  name: string;
  type: string;
  rarity: string;
  quantity: number;
  stats: Record<string, number>;
  useEffect?: {
    type: 'heal' | 'buff' | 'restoreEnergy' | 'restoreStamina' | 'xpBoost';
    value: number;
    duration?: number;
  };
  equipped?: boolean;
  purchasedAt: number;
  expiresAt?: number;
}

export interface Pet {
  id: string;
  name: string;
  level: number;
  xp: number;
  happiness: number;
  hunger: number;
  stats: Record<string, number>;
  equipped: boolean;
}

export interface QuestProgress {
  questId: string;
  objective: string;
  current: number;
  target: number;
  completed: boolean;
}

export interface User {
  jid: string;
  name: string;
  isOwner: boolean;
  isBanned: boolean;
  level: number;
  xp: number;
  money: number;
  bank: number;
  lastDaily?: number;
  lastWeekly?: number;
  lastMonthly?: number;
  weeklyStreak?: number;
  totalCommands: number;
  warnings: number;
  inventory: InventoryItem[];
  achievements: string[];
  createdAt: number;
  updatedAt: number;
  currentClass?: string;
  stats: RPGStats;
  pets: Pet[];
  activeQuests: QuestProgress[];
  completedQuests: string[];
  activeBuffs: Array<{
    buffId: string;
    stat: string;
    value: number;
    expiresAt: number;
  }>;
}

export class UserService {
  private readonly COLLECTION = 'users';
  private readonly OWNER_MONEY = 999999999;
  private readonly OWNER_LEVEL = 999;
  private readonly OWNER_XP = 999999;

  constructor(private db: IDatabase) {}

  private isOwnerJid(jid: string): boolean {
    if (config.owners.includes(jid)) {
      return true;
    }

    const jidBase = jid.split('@')[0];
    if (config.owners.includes(jidBase)) {
      return true;
    }

    const isOwner = config.owners.some(owner => {
      const cleanOwner = owner.split('@')[0];
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
        inventory: this.normalizeInventory(existing.inventory || []),
        achievements: existing.achievements || [],
        stats: existing.stats || this.getDefaultStats(),
        pets: existing.pets || [],
        activeQuests: existing.activeQuests || [],
        completedQuests: existing.completedQuests || [],
        activeBuffs: existing.activeBuffs || [],
      };

      if (existing.isOwner !== isOwner) {
        await this.db.update<User>(this.COLLECTION, jid, { isOwner });
      }

      return updatedUser;
    }

    const newUser: User = {
      jid,
      name: 'User',
      isOwner,
      isBanned: false,
      level: isOwner ? this.OWNER_LEVEL : 1,
      xp: isOwner ? this.OWNER_XP : 0,
      money: isOwner ? this.OWNER_MONEY : 0,
      bank: 0,
      totalCommands: 0,
      warnings: 0,
      inventory: [],
      achievements: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      currentClass: undefined,
      stats: {
        hp: 100,
        maxHp: 100,
        energy: 100,
        maxEnergy: 100,
        stamina: 100,
        maxStamina: 100,
        atk: 10,
        def: 5,
        str: 10,
        int: 10,
        agi: 10,
        vit: 10,
        luck: 5,
        critChance: 5,
        dodgeChance: 5,
      },
      pets: [],
      activeQuests: [],
      completedQuests: [],
      activeBuffs: [],
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

  async transferMoney(fromJid: string, toJid: string, amount: number): Promise<boolean> {
    const fromUser = await this.getUser(fromJid);
    const toUser = await this.getUser(toJid);

    if (fromUser.isOwner || toUser.isOwner) {
      if (fromUser.isOwner) {
        await this.updateUser(toJid, {
          money: toUser.isOwner ? this.OWNER_MONEY : toUser.money + amount,
        });
        return true;
      }
      if (toUser.isOwner) {
        return true;
      }
    }

    if (fromUser.money < amount) {
      return false;
    }

    await this.updateUser(fromJid, {
      money: fromUser.money - amount,
    });

    await this.updateUser(toJid, {
      money: toUser.money + amount,
    });

    return true;
  }

  async addBank(jid: string, amount: number): Promise<void> {
    const user = await this.getUser(jid);

    if (user.isOwner) {
      await this.updateUser(jid, {
        bank: this.OWNER_MONEY,
      });
      return;
    }

    await this.updateUser(jid, {
      bank: (user.bank || 0) + amount,
    });
  }

  async removeBank(jid: string, amount: number): Promise<boolean> {
    const user = await this.getUser(jid);

    if (user.isOwner) {
      return true;
    }

    if ((user.bank || 0) < amount) {
      return false;
    }

    await this.updateUser(jid, {
      bank: user.bank - amount,
    });

    return true;
  }

  async getBankBalance(jid: string): Promise<number> {
    const user = await this.getUser(jid);
    return user.isOwner ? this.OWNER_MONEY : user.bank || 0;
  }

  async getTotalBalance(jid: string): Promise<number> {
    const user = await this.getUser(jid);
    if (user.isOwner) return this.OWNER_MONEY;
    return user.money + (user.bank || 0);
  }

  async incrementCommands(jid: string): Promise<void> {
    const user = await this.getUser(jid);
    await this.updateUser(jid, {
      totalCommands: user.totalCommands + 1,
    });
  }

  async banUser(jid: string, _reason?: string): Promise<void> {
    const user = await this.getUser(jid);

    if (user.isOwner) {
      throw new Error('Cannot ban an owner');
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
      await this.banUser(jid, 'Accumulated 3 warnings');
    }

    return newWarnings;
  }

  async addItem(jid: string, itemId: string): Promise<void> {
    const user = await this.getUser(jid);

    const exists = user.inventory.some(i => i.itemId === itemId);

    if (!exists) {
      const newItem: InventoryItem = {
        itemId,
        name: itemId,
        type: 'material',
        rarity: 'common',
        quantity: 1,
        stats: {},
        equipped: false,
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

    const index = user.inventory.findIndex(i => i.itemId === itemId);

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
    return user.inventory.some(i => i.itemId === itemId);
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

  async getAllUsersPaginated(page: number = 1, limit: number = 20) {
    return await this.db.getPaginated<User>(this.COLLECTION, {
      page,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  }

  async getTopByXP(limit: number = 10): Promise<User[]> {
    const result = await this.db.getPaginated<User>(this.COLLECTION, {
      page: 1,
      limit: Math.min(limit + 20, 200),
      sortBy: 'xp',
      sortOrder: 'desc',
    });
    return result.items.filter(u => !u.isOwner).slice(0, limit);
  }

  async getTopByMoney(limit: number = 10): Promise<User[]> {
    const result = await this.db.getPaginated<User>(this.COLLECTION, {
      page: 1,
      limit: Math.min(limit + 20, 200),
      sortBy: 'money',
      sortOrder: 'desc',
    });
    return result.items.filter(u => !u.isOwner).slice(0, limit);
  }

  async getTopByLevel(limit: number = 10): Promise<User[]> {
    const result = await this.db.getPaginated<User>(this.COLLECTION, {
      page: 1,
      limit: Math.min(limit + 20, 200),
      sortBy: 'level',
      sortOrder: 'desc',
    });
    return result.items.filter(u => !u.isOwner).slice(0, limit);
  }

  async getTopByXPWithPagination(page: number = 1, limit: number = 10) {
    const result = await this.db.getPaginated<User>(this.COLLECTION, {
      page,
      limit,
      sortBy: 'xp',
      sortOrder: 'desc',
    });
    return {
      ...result,
      items: result.items.filter(u => !u.isOwner),
    };
  }

  async getTopByMoneyWithPagination(page: number = 1, limit: number = 10) {
    const result = await this.db.getPaginated<User>(this.COLLECTION, {
      page,
      limit,
      sortBy: 'money',
      sortOrder: 'desc',
    });
    return {
      ...result,
      items: result.items.filter(u => !u.isOwner),
    };
  }

  async getTopByLevelWithPagination(page: number = 1, limit: number = 10) {
    const result = await this.db.getPaginated<User>(this.COLLECTION, {
      page,
      limit,
      sortBy: 'level',
      sortOrder: 'desc',
    });
    return {
      ...result,
      items: result.items.filter(u => !u.isOwner),
    };
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

  async grantMoney(fromJid: string, toJid: string, amount: number): Promise<boolean> {
    const fromUser = await this.getUser(fromJid);

    if (!fromUser.isOwner) {
      throw new Error('Only owners can grant money');
    }

    await this.addMoney(toJid, amount);
    return true;
  }

  async grantXP(fromJid: string, toJid: string, amount: number): Promise<void> {
    const fromUser = await this.getUser(fromJid);

    if (!fromUser.isOwner) {
      throw new Error('Only owners can grant XP');
    }

    await this.addXP(toJid, amount);
  }

  async grantItem(fromJid: string, toJid: string, item: string): Promise<boolean> {
    const fromUser = await this.getUser(fromJid);

    if (!fromUser.isOwner) {
      throw new Error('Only owners can grant items');
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
    },
  ): Promise<void> {
    const user = await this.getUser(jid);

    const newItem: InventoryItem = {
      ...item,
      rarity: 'common',
      quantity: 1,
      stats: {},
      equipped: false,
    };

    const newInventory = [...user.inventory, newItem];

    await this.db.update<User>(this.COLLECTION, jid, {
      inventory: newInventory,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  normalizeInventory(inventory: any[]): InventoryItem[] {
    return inventory.map(item => ({
      itemId: item.itemId,
      name: item.name,
      type: item.type || 'material',
      rarity: item.rarity || 'common',
      quantity: item.quantity || 1,
      stats: item.stats || {},
      useEffect: item.useEffect,
      equipped: item.equipped || false,
      purchasedAt: item.purchasedAt || Date.now(),
      expiresAt: item.expiresAt,
    }));
  }

  getDefaultStats(): RPGStats {
    return {
      hp: 100,
      maxHp: 100,
      energy: 100,
      maxEnergy: 100,
      stamina: 100,
      maxStamina: 100,
      atk: 10,
      def: 5,
      str: 10,
      int: 10,
      agi: 10,
      vit: 10,
      luck: 5,
      critChance: 5,
      dodgeChance: 5,
    };
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
