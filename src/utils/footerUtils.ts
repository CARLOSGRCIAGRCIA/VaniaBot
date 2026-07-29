import type { WASocket } from 'baileys';
import { primeService } from '@/services/system/PrimeService.js';

export async function getFooter(
  sock: WASocket,
  groupJid: string,
  isGroup: boolean,
): Promise<string> {
  return await primeService.formatFooter(sock, groupJid, isGroup);
}

export async function getStickerInfo(
  sock: WASocket,
  groupJid: string,
  isGroup: boolean,
): Promise<{ pack: string; author: string }> {
  return await primeService.formatStickerInfo(sock, groupJid, isGroup);
}
