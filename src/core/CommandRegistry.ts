/**
 * CommandRegistry.ts
 *
 * Central registry for managing bot commands and their aliases.
 * Handles command registration, retrieval, and cooldown tracking.
 *
 * @author **Carlos G** ⭐
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import type { ICommand } from '@/types/index.js';
import { logger } from '@/utils/logger.js';

/**
 * Registry for managing commands and their aliases.
 */
export class CommandRegistry {
  private commands = new Map<string, ICommand>();
  private aliases = new Map<string, string>();
  private cooldowns = new Map<string, Map<string, number>>();

  register(command: ICommand): void {
    this.commands.set(command.name, command);

    logger.debug(`Registrando comando: ${command.name}`);

    command.aliases?.forEach(alias => {
      this.aliases.set(alias, command.name);
      logger.debug(`  - Alias registrado: ${alias} → ${command.name}`);
    });
  }

  get(nameOrAlias: string): ICommand | undefined {
    const commandName = this.aliases.get(nameOrAlias) || nameOrAlias;
    return this.commands.get(commandName);
  }

  getAll(): ICommand[] {
    return Array.from(this.commands.values());
  }

  checkCooldown(commandName: string, userId: string, cooldownTime: number): boolean {
    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Map());
    }

    const timestamps = this.cooldowns.get(commandName);
    if (!timestamps) {
      return true;
    }

    const now = Date.now();

    if (timestamps.has(userId)) {
      const userTimestamp = timestamps.get(userId);
      // This should exist because we just checked has()
      if (userTimestamp !== undefined) {
        const expirationTime = userTimestamp + cooldownTime;

        if (now < expirationTime) {
          return false;
        }
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

export const commandRegistry = new CommandRegistry();
