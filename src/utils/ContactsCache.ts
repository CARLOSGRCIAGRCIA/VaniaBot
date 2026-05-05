import type { WASocket } from '@whiskeysockets/baileys';

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
    } catch {}
  }
}

export const contactsCache = new ContactsCache();
