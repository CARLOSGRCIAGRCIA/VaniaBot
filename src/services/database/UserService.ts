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

  /**
   * Verifica si un JID es owner según la configuración Y la base de datos
   * Soporta:
   * - Números simples: "529516526675"
   * - JIDs completos estándar: "529516526675@s.whatsapp.net"
   * - JIDs de canal: "208924405956643@lid"
   * - Owners agregados dinámicamente en la DB
   */
  private async isOwnerJidAsync(jid: string): Promise<boolean> {
    // 1. Verificar si el JID completo está en la lista de owners del .env
    if (config.owners.includes(jid)) {
      return true;
    }

    // 2. Extraer la parte antes del @ y verificar
    const jidBase = jid.split("@")[0];
    if (config.owners.includes(jidBase)) {
      return true;
    }

    // 3. Verificar si algún owner está contenido en el JID
    const inConfig = config.owners.some((owner) => {
      const cleanOwner = owner.split("@")[0];
      return jid.includes(cleanOwner) || jidBase === cleanOwner;
    });

    if (inConfig) {
      return true;
    }

    // 4. Verificar en la base de datos (para owners agregados con !setowner)
    try {
      const existingUser = await this.db.get<User>(this.COLLECTION, jid);
      return existingUser?.isOwner || false;
    } catch {
      return false;
    }
  }

  /**
   * Versión síncrona para compatibilidad con código existente
   * Solo verifica el .env, no la base de datos
   */
  private isOwnerJid(jid: string): boolean {
    // 1. Verificar si el JID completo está en la lista de owners
    if (config.owners.includes(jid)) {
      return true;
    }

    // 2. Extraer la parte antes del @ y verificar
    const jidBase = jid.split("@")[0];
    if (config.owners.includes(jidBase)) {
      return true;
    }

    // 3. Verificar si algún owner está contenido en el JID
    const isOwner = config.owners.some((owner) => {
      const cleanOwner = owner.split("@")[0];
      return jid.includes(cleanOwner) || jidBase === cleanOwner;
    });

    return isOwner;
  }

  async getUser(jid: string): Promise<User> {
    const existing = await this.db.get<User>(this.COLLECTION, jid);

    // Verificar si el JID está en la lista de owners O en la base de datos
    const isOwnerFromConfig = this.isOwnerJid(jid);
    const isOwnerFromDB = existing?.isOwner || false;

    // Es owner si está en el config O en la base de datos
    const isOwner = isOwnerFromConfig || isOwnerFromDB;

    if (existing) {
      // Asegurar que inventory y achievements existen
      const updatedUser = {
        ...existing,
        isOwner, // Actualizar según configuración actual O base de datos
        inventory: existing.inventory || [],
        achievements: existing.achievements || [],
      };

      // Si cambió el estado de owner, actualizar en la base de datos
      if (existing.isOwner !== isOwner) {
        await this.db.update<User>(this.COLLECTION, jid, { isOwner });
      }

      return updatedUser;
    }

    const newUser: User = {
      jid,
      name: "User",
      isOwner, // Establecer según configuración
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

    // Los owners no necesitan XP, ya están al máximo
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

    // Los owners tienen dinero ilimitado
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

    // No se puede banear a un owner
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

    // Los owners no reciben advertencias
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

    // Los owners ya tienen todos los logros por defecto
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

    // Los owners tienen todos los logros
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
      .filter((u) => !u.isOwner) // Excluir owners de rankings
      .sort((a, b) => b.xp - a.xp)
      .slice(0, limit);
  }

  async getTopByMoney(limit: number = 10): Promise<User[]> {
    const users = await this.getAllUsers();
    return users
      .filter((u) => !u.isOwner) // Excluir owners de rankings
      .sort((a, b) => b.money - a.money)
      .slice(0, limit);
  }

  async getTopByLevel(limit: number = 10): Promise<User[]> {
    const users = await this.getAllUsers();
    return users
      .filter((u) => !u.isOwner) // Excluir owners de rankings
      .sort((a, b) => b.level - a.level)
      .slice(0, limit);
  }

  private calculateLevel(xp: number): number {
    return Math.floor(Math.sqrt(xp / 100)) + 1;
  }

  getRequiredXPForNextLevel(level: number): number {
    return level ** 2 * 100;
  }

  /**
   * Establece o remueve permisos de owner a un usuario
   */
  async setOwner(jid: string, isOwner: boolean): Promise<void> {
    await this.updateUser(jid, {
      isOwner,
    });

    if (isOwner) {
      // Remover ban si existe
      await this.updateUser(jid, {
        isBanned: false,
        warnings: 0,
      });
    }
  }

  /**
   * Concede dinero a un usuario (solo owners pueden usar esto)
   */
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

  /**
   * Concede XP a un usuario (solo owners pueden usar esto)
   */
  async grantXP(fromJid: string, toJid: string, amount: number): Promise<void> {
    const fromUser = await this.getUser(fromJid);

    if (!fromUser.isOwner) {
      throw new Error("Solo los owners pueden conceder XP");
    }

    await this.addXP(toJid, amount);
  }

  /**
   * Concede items a un usuario (solo owners pueden usar esto)
   */
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
