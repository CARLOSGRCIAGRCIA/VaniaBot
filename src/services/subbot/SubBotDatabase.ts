/**
 * SubBotDatabase.ts
 *
 * Database manager for subbots.
 * Stores subbot configuration in a JSON file with in-memory persistence.
 *
 * @author **Carlos G** ⭐
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'fs';
import type { SubBotConfig } from '@/types/subbot.js';

const DB_PATH = './data/subbots.json';

/**
 * Database for subbots.
 * Implements Singleton pattern for persistence management.
 *
 * @example
 * ```typescript
 * const db = SubBotDatabase.getInstance();
 * const subBot = db.get(subBotId);
 * ```
 */
export class SubBotDatabase {
  private static instance: SubBotDatabase;
  private data: Map<string, SubBotConfig> = new Map();

  /**
   * Private constructor for Singleton pattern.
   * Loads data from JSON file on initialization.
   */
  private constructor() {
    this.load();
  }

  /**
   * Gets the unique database instance.
   *
   * @returns SubBotDatabase instance
   */
  static getInstance(): SubBotDatabase {
    if (!SubBotDatabase.instance) {
      SubBotDatabase.instance = new SubBotDatabase();
    }
    return SubBotDatabase.instance;
  }

  /**
   * Loads subbot data from JSON file.
   * Creates the file and directory if they don't exist.
   *
   * @returns void
   */
  private load(): void {
    try {
      mkdirSync('./data', { recursive: true });
      if (!existsSync(DB_PATH)) {
        writeFileSync(DB_PATH, '{}', 'utf8');
        return;
      }
      const raw = readFileSync(DB_PATH, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, SubBotConfig>;
      for (const [id, cfg] of Object.entries(parsed)) {
        this.data.set(id, cfg);
      }
    } catch {
      this.data = new Map();
    }
  }

  /**
   * Saves all data to JSON file.
   * Called after every mutation operation.
   * Uses atomic write (tmp + rename) to prevent corruption.
   *
   * @returns void
   */
  private save(): void {
    const obj: Record<string, SubBotConfig> = {};
    for (const [id, cfg] of this.data.entries()) {
      obj[id] = cfg;
    }

    try {
      const tmpPath = DB_PATH + '.tmp';
      writeFileSync(tmpPath, JSON.stringify(obj, null, 2), 'utf8');
      renameSync(tmpPath, DB_PATH);
    } catch (error) {
      console.error('[SubBotDatabase] Failed to save:', error);
      try {
        const fallbackPath = DB_PATH + '.fallback';
        writeFileSync(fallbackPath, JSON.stringify(obj, null, 2), 'utf8');
      } catch (fallbackError) {
        console.error('[SubBotDatabase] Fallback save also failed:', fallbackError);
      }
    }
  }

  /**
   * Gets a subbot by its unique ID.
   *
   * @param id - The unique identifier of the subbot
   * @returns SubBotConfig or undefined if not found
   */
  get(id: string): SubBotConfig | undefined {
    return this.data.get(id);
  }

  /**
   * Gets a subbot by the owner's JID.
   *
   * @param ownerJid - The JID of the owner
   * @returns SubBotConfig or undefined if not found
   */
  getByOwner(ownerJid: string): SubBotConfig | undefined {
    for (const cfg of this.data.values()) {
      if (cfg.ownerJid === ownerJid) return cfg;
    }
    return undefined;
  }

  /**
   * Gets all registered subbots.
   *
   * @returns Array of all SubBotConfig
   */
  getAll(): SubBotConfig[] {
    return Array.from(this.data.values());
  }

  /**
   * Gets all active subbots.
   *
   * @returns Array of active SubBotConfig
   */
  getActive(): SubBotConfig[] {
    return this.getAll().filter(s => s.active);
  }

  /**
   * Saves a new subbot configuration.
   *
   * @param cfg - The subbot configuration to save
   * @returns void
   */
  set(cfg: SubBotConfig): void {
    this.data.set(cfg.id, cfg);
    this.save();
  }

  /**
   * Updates an existing subbot configuration.
   *
   * @param id - The subbot ID to update
   * @param partial - Partial configuration to merge
   * @returns void
   */
  update(id: string, partial: Partial<SubBotConfig>): void {
    const existing = this.data.get(id);
    if (!existing) return;
    this.data.set(id, { ...existing, ...partial });
    this.save();
  }

  /**
   * Deletes a subbot by ID.
   *
   * @param id - The subbot ID to delete
   * @returns void
   */
  delete(id: string): void {
    this.data.delete(id);
    this.save();
  }

  /**
   * Checks if a subbot exists by ID.
   *
   * @param id - The subbot ID to check
   * @returns true if exists, false otherwise
   */
  exists(id: string): boolean {
    return this.data.has(id);
  }

  /**
   * Checks if a subbot exists by owner's JID.
   *
   * @param ownerJid - The owner's JID to check
   * @returns true if owner has a subbot, false otherwise
   */
  existsByOwner(ownerJid: string): boolean {
    return !!this.getByOwner(ownerJid);
  }
}

export const subBotDatabase = SubBotDatabase.getInstance();
