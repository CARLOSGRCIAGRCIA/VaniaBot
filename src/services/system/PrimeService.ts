import type { WASocket } from '@whiskeysockets/baileys';
import type { GroupService } from '../database/GroupService.js';
import { cacheManager } from '@/core/CacheManager.js';

export class PrimeService {
  private static instance: PrimeService;
  private groupService!: GroupService;
  private groupPicCache = new Map<string, { url: string; timestamp: number }>();
  private readonly PIC_CACHE_TTL = 60 * 60 * 1000;

  private constructor() {}

  static getInstance(): PrimeService {
    if (!PrimeService.instance) {
      PrimeService.instance = new PrimeService();
    }
    return PrimeService.instance;
  }

  setGroupService(groupService: GroupService): void {
    this.groupService = groupService;
  }

  async isPrimeEnabled(groupJid: string): Promise<boolean> {
    try {
      const group = await this.groupService.getGroup(groupJid);
      return group.prime?.enabled ?? false;
    } catch {
      return false;
    }
  }

  async enablePrime(groupJid: string): Promise<void> {
    await this.groupService.updateGroup(groupJid, {
      prime: { enabled: true },
    });
  }

  async disablePrime(groupJid: string): Promise<void> {
    await this.groupService.updateGroup(groupJid, {
      prime: { enabled: false },
    });
  }

  async getGroupName(sock: WASocket, groupJid: string): Promise<string> {
    try {
      const metadata = await cacheManager.getGroupMetadataSafe(sock, groupJid);
      return metadata?.subject || 'Grupo';
    } catch {
      return 'Grupo';
    }
  }

  async getGroupPicUrl(sock: WASocket, groupJid: string): Promise<string | null> {
    const cached = this.groupPicCache.get(groupJid);
    if (cached && Date.now() - cached.timestamp < this.PIC_CACHE_TTL) {
      return cached.url;
    }

    try {
      const picUrl = await sock.profilePictureUrl(groupJid, 'image');
      if (picUrl) {
        this.groupPicCache.set(groupJid, { url: picUrl, timestamp: Date.now() });
      }
      return picUrl || null;
    } catch {
      return null;
    }
  }

  clearGroupPicCache(groupJid?: string): void {
    if (groupJid) {
      this.groupPicCache.delete(groupJid);
    } else {
      this.groupPicCache.clear();
    }
  }

  async formatFooter(sock: WASocket, groupJid: string, isGroup: boolean): Promise<string> {
    if (!isGroup) {
      return '> VaniaBot💝';
    }

    const primeEnabled = await this.isPrimeEnabled(groupJid);

    if (!primeEnabled) {
      return '> VaniaBot💝';
    }

    const groupName = await this.getGroupName(sock, groupJid);
    return `> ${groupName}💝`;
  }

  async formatStickerInfo(
    sock: WASocket,
    groupJid: string,
    isGroup: boolean,
  ): Promise<{ pack: string; author: string }> {
    if (!isGroup) {
      return { pack: 'VaniaBot', author: 'VaniaBot' };
    }

    const primeEnabled = await this.isPrimeEnabled(groupJid);

    if (!primeEnabled) {
      return { pack: 'VaniaBot', author: 'VaniaBot' };
    }

    const groupName = await this.getGroupName(sock, groupJid);
    return { pack: groupName, author: groupName };
  }
}

export const primeService = PrimeService.getInstance();
