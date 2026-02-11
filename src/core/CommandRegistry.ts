import type { ICommand } from "@/types/index.js";
import { logger } from "@/utils/logger.js";

export class CommandRegistry {
  private commands = new Map<string, ICommand>();
  private aliases = new Map<string, string>();
  private cooldowns = new Map<string, Map<string, number>>();

  register(command: ICommand): void {
    this.commands.set(command.name, command);

    command.aliases?.forEach((alias) => {
      this.aliases.set(alias, command.name);
    });
  }

  get(nameOrAlias: string): ICommand | undefined {
    const commandName = this.aliases.get(nameOrAlias) || nameOrAlias;
    return this.commands.get(commandName);
  }

  getAll(): ICommand[] {
    return Array.from(this.commands.values());
  }

  checkCooldown(
    commandName: string,
    userId: string,
    cooldownTime: number,
  ): boolean {
    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Map());
    }

    const timestamps = this.cooldowns.get(commandName)!;
    const now = Date.now();

    if (timestamps.has(userId)) {
      const expirationTime = timestamps.get(userId)! + cooldownTime;

      if (now < expirationTime) {
        return false;
      }
    }

    timestamps.set(userId, now);
    setTimeout(() => timestamps.delete(userId), cooldownTime);

    return true;
  }

  get size(): number {
    return this.commands.size;
  }
}
