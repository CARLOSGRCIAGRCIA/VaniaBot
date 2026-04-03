/**
 * SubBotDatabase.ts
 *
 * Database manager for subbots with slot system.
 * Handles up to 50 slots numbered 1-50.
 *
 * @author **Carlos G** ⭐
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'fs';
import { SUBBOT_CONFIG } from '@/config/subbot.js';
import type { SubBotConfig, SubBotSlot, SubBotSlotStatus } from '@/types/subbot.js';

const DB_PATH = './data/subbots.json';

interface DatabaseData {
  slots: SubBotSlot[];
  settings: {
    maxSlots: number;
    publicRequests: boolean;
  };
}

function createDefaultSlot(slotNumber: number): SubBotSlot {
  return {
    slot: slotNumber,
    status: 'free',
  };
}

function createDefaultData(): DatabaseData {
  const slots: SubBotSlot[] = [];
  for (let i = 1; i <= SUBBOT_CONFIG.MAX_SLOTS; i++) {
    slots.push(createDefaultSlot(i));
  }
  return {
    slots,
    settings: {
      maxSlots: SUBBOT_CONFIG.DEFAULT_SLOTS,
      publicRequests: SUBBOT_CONFIG.PUBLIC_REQUESTS,
    },
  };
}

function mapSlotToConfig(slot: SubBotSlot): SubBotConfig | undefined {
  if (!slot.id) return undefined;
  return {
    id: slot.id,
    ownerJid: slot.ownerJid || '',
    ownerName: slot.ownerName || '',
    phoneNumber: slot.phoneNumber || '',
    sessionPath: `${SUBBOT_CONFIG.SESSION_BASE_PATH}/${slot.id}`,
    prefix: '.',
    name: slot.name || `VaniaBot-${slot.slot}`,
    active: slot.status === 'connected',
    createdAt: slot.requestedAt || Date.now(),
    connectedAt: slot.connectedAt,
    status: mapSlotStatusToLegacy(slot.status),
    slot: slot.slot,
    label: `SUBBOT${slot.slot}`,
    bio: slot.bio,
    photo: slot.photo,
    requesterNumber: slot.requesterNumber,
    requestedAt: slot.requestedAt,
    releasedAt: slot.releasedAt,
  };
}

function mapSlotStatusToLegacy(status: SubBotSlotStatus): SubBotConfig['status'] {
  switch (status) {
    case 'connected':
      return 'connected';
    case 'pending':
    case 'linking':
    case 'reserved':
      return 'pending';
    case 'disconnected':
      return 'disconnected';
    case 'free':
      return 'pending';
    default:
      return 'pending';
  }
}

function mapLegacyStatusToSlot(status: SubBotConfig['status']): SubBotSlotStatus {
  switch (status) {
    case 'connected':
      return 'connected';
    case 'pending':
      return 'pending';
    case 'connecting':
      return 'linking';
    case 'disconnected':
      return 'disconnected';
    case 'error':
      return 'disconnected';
    default:
      return 'free';
  }
}

export class SubBotDatabase {
  private static instance: SubBotDatabase;
  private data: DatabaseData;
  private configMap: Map<string, SubBotConfig> = new Map();

  private constructor() {
    this.data = createDefaultData();
    this.load();
  }

  static getInstance(): SubBotDatabase {
    if (!SubBotDatabase.instance) {
      SubBotDatabase.instance = new SubBotDatabase();
    }
    return SubBotDatabase.instance;
  }

  private load(): void {
    try {
      mkdirSync('./data', { recursive: true });
      mkdirSync(SUBBOT_CONFIG.SESSION_BASE_PATH, { recursive: true });

      if (!existsSync(DB_PATH)) {
        this.save();
        return;
      }

      const raw = readFileSync(DB_PATH, 'utf8');
      const parsed = JSON.parse(raw) as Partial<DatabaseData>;

      if (parsed.slots && Array.isArray(parsed.slots)) {
        this.data.slots = parsed.slots;
        for (const slot of this.data.slots) {
          const config = mapSlotToConfig(slot);
          if (config) {
            this.configMap.set(config.id, config);
          }
        }
      }

      if (parsed.settings) {
        this.data.settings = {
          maxSlots: parsed.settings.maxSlots || SUBBOT_CONFIG.DEFAULT_SLOTS,
          publicRequests: parsed.settings.publicRequests ?? SUBBOT_CONFIG.PUBLIC_REQUESTS,
        };
      }
    } catch {
      this.data = createDefaultData();
    }
  }

  getSlot(slotNumber: number): SubBotSlot | undefined {
    return this.data.slots.find(s => s.slot === slotNumber);
  }

  getFreeSlot(): SubBotSlot | undefined {
    return this.data.slots.find(s => s.status === 'free' && s.slot <= this.data.settings.maxSlots);
  }

  getOwnerSlots(ownerJid: string): SubBotSlot[] {
    return this.data.slots.filter(s => s.ownerJid === ownerJid && s.status !== 'free');
  }

  getOwnerSlotById(ownerJid: string, slotNumber: number): SubBotSlot | undefined {
    const slot = this.getSlot(slotNumber);
    if (slot && slot.ownerJid === ownerJid) {
      return slot;
    }
    return undefined;
  }

  getActiveSlots(): SubBotSlot[] {
    return this.data.slots.filter(
      s => s.status !== 'free' && s.slot <= this.data.settings.maxSlots,
    );
  }

  getUsedSlotCount(): number {
    return this.getActiveSlots().length;
  }

  getMaxSlots(): number {
    return this.data.settings.maxSlots;
  }

  setMaxSlots(max: number): void {
    this.data.settings.maxSlots = Math.max(1, Math.min(SUBBOT_CONFIG.MAX_SLOTS, max));
    this.save();
  }

  isPublicRequestsEnabled(): boolean {
    return this.data.settings.publicRequests;
  }

  setPublicRequests(enabled: boolean): void {
    this.data.settings.publicRequests = enabled;
    this.save();
  }

  reserveSlot(
    slotNumber: number,
    requesterNumber: string,
    _requesterName: string,
  ): SubBotSlot | null {
    const slot = this.getSlot(slotNumber);
    if (!slot || slot.status !== 'free') return null;

    slot.status = 'reserved';
    slot.requesterNumber = requesterNumber;
    slot.requestedAt = Date.now();
    this.save();
    return slot;
  }

  activateSlot(
    slotNumber: number,
    subBotId: string,
    ownerJid: string,
    _ownerName: string,
    phoneNumber: string,
    name: string,
  ): SubBotConfig | null {
    const slot = this.getSlot(slotNumber);
    if (!slot) return null;

    slot.id = subBotId;
    slot.ownerJid = ownerJid;
    slot.ownerName = _ownerName;
    slot.phoneNumber = phoneNumber;
    slot.name = name;
    slot.status = 'pending';
    slot.requestedAt = Date.now();

    const config = mapSlotToConfig(slot);
    if (!config) return null;
    this.configMap.set(config.id, config);
    this.save();
    return config;
  }

  updateSlotStatus(slotNumber: number, status: SubBotSlotStatus): void {
    const slot = this.getSlot(slotNumber);
    if (!slot) return;
    slot.status = status;

    if (status === 'connected') {
      slot.connectedAt = Date.now();
    }

    const config = this.configMap.get(slot.id || '');
    if (config) {
      config.status = mapSlotStatusToLegacy(status);
      config.active = status === 'connected';
      if (status === 'connected') {
        config.connectedAt = slot.connectedAt;
      }
    }

    this.save();
  }

  releaseSlot(slotNumber: number): void {
    const slot = this.getSlot(slotNumber);
    if (!slot) return;

    const config = this.configMap.get(slot.id || '');
    if (config) {
      this.configMap.delete(config.id);
    }

    slot.id = undefined;
    slot.ownerJid = undefined;
    slot.ownerName = undefined;
    slot.phoneNumber = undefined;
    slot.name = undefined;
    slot.status = 'free';
    slot.releasedAt = Date.now();
    slot.connectedAt = undefined;

    this.save();
  }

  save(): void {
    try {
      const tmpPath = DB_PATH + '.tmp';
      writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), 'utf8');
      renameSync(tmpPath, DB_PATH);
    } catch (error) {
      console.error('[SubBotDatabase] Failed to save:', error);
      try {
        const fallbackPath = DB_PATH + '.fallback';
        writeFileSync(fallbackPath, JSON.stringify(this.data, null, 2), 'utf8');
      } catch {
        console.error('[SubBotDatabase] Fallback save also failed');
      }
    }
  }

  getAllSlots(): SubBotSlot[] {
    return this.data.slots;
  }

  get(subBotId: string): SubBotConfig | undefined {
    return this.configMap.get(subBotId);
  }

  getByOwner(ownerJid: string): SubBotConfig | undefined {
    for (const config of this.configMap.values()) {
      if (config.ownerJid === ownerJid) return config;
    }
    return undefined;
  }

  getAll(): SubBotConfig[] {
    return Array.from(this.configMap.values());
  }

  getActive(): SubBotConfig[] {
    return this.getAll().filter(s => s.active || s.status === 'connected');
  }

  update(subBotId: string, partial: Partial<SubBotConfig>): void {
    const existing = this.configMap.get(subBotId);
    if (!existing) return;

    const updated = { ...existing, ...partial };
    this.configMap.set(subBotId, updated);

    const slot = this.getSlot(existing.slot);
    if (slot) {
      if (partial.connectedAt !== undefined) slot.connectedAt = partial.connectedAt;
      if (partial.status !== undefined) {
        slot.status = mapLegacyStatusToSlot(partial.status);
      }
    }

    this.save();
  }

  delete(subBotId: string): void {
    const config = this.configMap.get(subBotId);
    if (!config) return;

    const slot = this.getSlot(config.slot);
    if (slot) {
      this.releaseSlot(config.slot);
    }

    this.configMap.delete(subBotId);
    this.save();
  }

  exists(subBotId: string): boolean {
    return this.configMap.has(subBotId);
  }

  existsByOwner(ownerJid: string): boolean {
    return !!this.getByOwner(ownerJid);
  }
}

export const subBotDatabase = SubBotDatabase.getInstance();
