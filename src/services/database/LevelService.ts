import type { IDatabase } from "./Database.js";
import { UserService } from "./UserService.js";

export interface LevelUpResult {
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
  xpGained: number;
  totalXP: number;
  nextLevelXP: number;
}

export class LevelService {
  constructor(
    private db: IDatabase,
    private userService: UserService,
  ) {}

  async addXP(jid: string, amount: number): Promise<LevelUpResult> {
    const user = await this.userService.getUser(jid);
    const oldLevel = user.level;
    const oldXP = user.xp;

    const updatedUser = await this.userService.addXP(jid, amount);
    const newLevel = updatedUser.level;

    return {
      leveledUp: newLevel > oldLevel,
      oldLevel,
      newLevel,
      xpGained: amount,
      totalXP: updatedUser.xp,
      nextLevelXP: this.userService.getRequiredXPForNextLevel(newLevel),
    };
  }

  async giveRandomXP(
    jid: string,
    min: number = 10,
    max: number = 25,
  ): Promise<LevelUpResult> {
    const amount = Math.floor(Math.random() * (max - min + 1)) + min;
    return await this.addXP(jid, amount);
  }

  async getLevelProgress(jid: string): Promise<{
    level: number;
    currentXP: number;
    requiredXP: number;
    percentage: number;
  }> {
    const user = await this.userService.getUser(jid);
    const currentLevelXP = this.userService.getRequiredXPForNextLevel(
      user.level - 1,
    );
    const nextLevelXP = this.userService.getRequiredXPForNextLevel(user.level);
    const xpInLevel = user.xp - currentLevelXP;
    const xpNeeded = nextLevelXP - currentLevelXP;

    return {
      level: user.level,
      currentXP: xpInLevel,
      requiredXP: xpNeeded,
      percentage: Math.floor((xpInLevel / xpNeeded) * 100),
    };
  }

  async getLeaderboard(limit: number = 10): Promise<
    Array<{
      jid: string;
      name: string;
      level: number;
      xp: number;
      rank: number;
    }>
  > {
    const topUsers = await this.userService.getTopByLevel(limit);

    return topUsers.map((user, index) => ({
      jid: user.jid,
      name: user.name,
      level: user.level,
      xp: user.xp,
      rank: index + 1,
    }));
  }

  formatLevelUpMessage(result: LevelUpResult, userName: string): string {
    return `
🎉 *¡NIVEL SUPERIOR!* 🎉

👤 ${userName}
📊 Nivel ${result.oldLevel} → ${result.newLevel}
✨ +${result.xpGained} XP
💫 XP Total: ${result.totalXP}

Sigue así! 🚀
`.trim();
  }

  createProgressBar(
    current: number,
    required: number,
    length: number = 10,
  ): string {
    const percentage = Math.min(current / required, 1);
    const filled = Math.floor(percentage * length);
    const empty = length - filled;

    return "█".repeat(filled) + "░".repeat(empty);
  }
}
