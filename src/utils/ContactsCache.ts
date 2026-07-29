import type { WASocket } from 'baileys';
import { logError } from '@/utils/logger.js';
import type { MessageContext } from '@/types/index.js';

class ContactsCache {
  private cache = new Map<string, string>();
  private loadedGroups = new Set<string>();

  set(jid: string, name: string): void {
    if (!name || name === 'User') return;
    this.cache.set(jid.split('@')[0].split(':')[0], name);
  }

  get(jid: string): string | undefined {
    return this.cache.get(jid.split('@')[0].split(':')[0]);
  }

  async getContactName(ctx: MessageContext, jid: string): Promise<string> {
    const cached = this.get(jid);
    if (cached) return cached;

    try {
      const groupMeta = await ctx.sock.groupMetadata(ctx.chat.jid);
      const targetBase = jid.split('@')[0].split(':')[0];

      const participant = groupMeta.participants.find(p => {
        const pBase = p.id.split('@')[0].split(':')[0];
        return pBase === targetBase;
      });

      if (participant) {
        const name = participant.notify || participant.name || participant.verifiedName;

        if (name) {
          this.set(participant.id, name);
          return name;
        }
      }
    } catch (error) {
      logError('[ContactsCache]', error);
    }

    return `@${jid.split('@')[0]}`;
  }

  async warmGroup(sock: WASocket, groupJid: string): Promise<void> {
    if (this.loadedGroups.has(groupJid)) return;
    this.loadedGroups.add(groupJid);

    try {
      const meta = await sock.groupMetadata(groupJid);
      for (const p of meta.participants) {
        const name =
          p.notify ||
          (p as { id: string; name?: string; verifiedName?: string })?.name ||
          (p as { id: string; name?: string; verifiedName?: string })?.verifiedName;
        if (name) this.set(p.id, name);
      }
    } catch (error) {
      logError('ContactsCache.loadParticipants', error);
    }
  }
}

export const contactsCache = new ContactsCache();
