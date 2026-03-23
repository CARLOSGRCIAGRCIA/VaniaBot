import type { WASocket } from '@whiskeysockets/baileys';
import { serviceManager } from './Servicemanager.js';
import { logger, logError } from '@/utils/logger.js';
import { existsSync, readFileSync } from 'fs';
import { circuitBreakerManager } from './CircuitBreakerService.js';
import { cacheManager } from '@/core/CacheManager.js';

export interface WelcomeConfig {
  enabled: boolean;
  message?: string;
  useProfilePic?: boolean;
}

export interface GoodbyeConfig {
  enabled: boolean;
  message?: string;
}

interface WelcomeConfigExtended extends WelcomeConfig {
  useProfilePic?: boolean;
}

const VANIABOT_FACTS: string[] = [
  '💌 El nombre VaniaBot nació en un dia cualquiera…',
  '💭 VaniaBot no es solo un bot…',
  '🌙 «VaniaBot» empezó como un juego…',
];

async function translateToSpanish(text: string): Promise<string> {
  try {
    const params = new URLSearchParams({ q: text, langpair: 'en|es' });
    const circuitBreaker = circuitBreakerManager.getOrCreate('mymemory-translate', {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 10000,
      monitoringPeriod: 60000,
      name: 'mymemory-translate',
    });

    return await circuitBreaker.execute(async () => {
      const res = await fetch(`https://api.mymemory.translated.net/get?${params}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as {
        responseData?: { translatedText?: string };
        responseStatus?: number;
      };
      const translated = data.responseData?.translatedText?.trim();
      if (!translated || data.responseStatus !== 200) {
        throw new Error('respuesta invalida de MyMemory');
      }
      return translated;
    });
  } catch (_err) {
    logger.warn(`[Translate] FAIL MyMemory — usando texto original`);
    return text;
  }
}

async function getRandomFact(): Promise<string> {
  const roll = Math.random();
  if (roll < 0.15) {
    return VANIABOT_FACTS[Math.floor(Math.random() * VANIABOT_FACTS.length)];
  }
  try {
    const circuitBreaker = circuitBreakerManager.getOrCreate('uselessfacts', {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 10000,
      monitoringPeriod: 60000,
      name: 'uselessfacts',
    });

    const raw = await circuitBreaker.execute(async () => {
      const res = await fetch('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { text?: string };
      const text = data.text?.trim();
      if (!text) throw new Error('respuesta vacia de la API');
      return text;
    });

    return await translateToSpanish(raw);
  } catch (_err) {
    return VANIABOT_FACTS[Math.floor(Math.random() * VANIABOT_FACTS.length)];
  }
}

function formatFact(fact: string): string {
  return `\n.・✦─⋆⋅ 𝘿𝙖𝙩𝙤 𝙘𝙪𝙧𝙞𝙤𝙨𝙤 ⋅⋆─✦・.\n${fact}\n.・✦────────────✦・.`;
}

export class WelcomeService {
  private readonly DEFAULT_PROFILE_PIC = './data/assets/logo.png';
  private readonly DEFAULT_WELCOME = `
✧･ﾟ:*  𝙚𝙮, 𝙣𝙪𝙚𝙫𝙖 𝙘𝙖𝙧𝙖  *:･ﾟ✧
hola @user ♡
@fact
✧･ﾟ:*  𝙑𝙖𝙣𝙞𝙖𝘽𝙤𝙩  *:･ﾟ✧
  `.trim();

  private readonly DEFAULT_GOODBYE = `
✧･ﾟ:*  𝙎𝙚 𝙡@ 𝙡𝙡𝙚𝙫@ 𝙡𝙖 𝙫𝙚𝙧𝙜𝙖  *:･ﾟ✧
@user dijo adiós
@count seguimos aquí
✧･ﾟ:*  𝙑𝙖𝙣𝙞𝙖𝘽𝙤𝙩  *:･ﾟ✧
  `.trim();

  async handleNewParticipant(sock: WASocket, groupJid: string, userJid: string): Promise<void> {
    try {
      const group = await serviceManager.groupService.getGroup(groupJid);
      if (!group.welcome.enabled) {
        logger.info(`[Welcome] Bienvenida desactivada en ${groupJid} — omitiendo`);
        return;
      }

      const metadata = await cacheManager.getGroupMetadataSafe(sock, groupJid);
      const rawFact = await getRandomFact();
      const formattedFact = formatFact(rawFact);

      const message = this.parseMessage(group.welcome.message || this.DEFAULT_WELCOME, {
        user: `@${userJid.split('@')[0]}`,
        group: metadata.subject,
        desc: metadata.desc || 'Sin descripción',
        count: metadata.participants.length.toString(),
        fact: formattedFact,
      });

      const welcomeExt = group.welcome as WelcomeConfigExtended;
      const useProfilePic = welcomeExt.useProfilePic !== false;

      let profilePicBuffer: Buffer | null = null;
      if (useProfilePic) {
        try {
          const profilePicUrl = await sock.profilePictureUrl(userJid, 'image');
          if (profilePicUrl) {
            const response = await fetch(profilePicUrl);
            profilePicBuffer = Buffer.from(await response.arrayBuffer());
          }
        } catch (_err) {
          if (existsSync(this.DEFAULT_PROFILE_PIC)) {
            profilePicBuffer = readFileSync(this.DEFAULT_PROFILE_PIC);
          }
        }
      }

      if (profilePicBuffer) {
        await sock.sendMessage(groupJid, {
          image: profilePicBuffer,
          caption: message,
          mentions: [userJid],
        });
      } else {
        await sock.sendMessage(groupJid, { text: message, mentions: [userJid] });
      }
    } catch (error) {
      logError('[Welcome] Error critico enviando bienvenida:', error);
    }
  }

  async handleParticipantLeft(sock: WASocket, groupJid: string, userJid: string): Promise<void> {
    try {
      const group = await serviceManager.groupService.getGroup(groupJid);
      if (!group.goodbye.enabled) {
        logger.info(`[Goodbye] Despedida desactivada en ${groupJid} — omitiendo`);
        return;
      }

      let metadata;
      try {
        metadata = await cacheManager.getGroupMetadataSafe(sock, groupJid);
      } catch (metadataError) {
        const errMsg =
          metadataError instanceof Error ? metadataError.message : String(metadataError);
        if (errMsg.includes('forbidden') || errMsg.includes('not-authorized')) {
          logger.warn(
            `[Goodbye] Sin acceso al grupo ${groupJid} — el bot pudo haber sido eliminado`,
          );
          return;
        }
        throw metadataError;
      }

      const message = this.parseMessage(group.goodbye.message || this.DEFAULT_GOODBYE, {
        user: `@${userJid.split('@')[0]}`,
        group: metadata.subject,
        desc: metadata.desc || 'Sin descripción',
        count: metadata.participants.length.toString(),
        fact: '',
      });

      await sock.sendMessage(groupJid, { text: message, mentions: [userJid] });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes('forbidden') || errMsg.includes('not-authorized')) {
        return;
      }
      logError('[Goodbye] Error enviando despedida:', error);
    }
  }

  private parseMessage(template: string, vars: Record<string, string>): string {
    let message = template;
    for (const [key, value] of Object.entries(vars)) {
      message = message.replace(new RegExp(`@${key}`, 'g'), value);
    }
    return message;
  }

  async enableWelcome(groupJid: string, message?: string, useProfilePic = true): Promise<void> {
    await serviceManager.groupService.updateGroup(groupJid, {
      welcome: {
        enabled: true,
        message: message || this.DEFAULT_WELCOME,
        ...(useProfilePic !== undefined && { useProfilePic }),
      },
    });
  }

  async disableWelcome(groupJid: string): Promise<void> {
    const group = await serviceManager.groupService.getGroup(groupJid);
    await serviceManager.groupService.updateGroup(groupJid, {
      welcome: { ...group.welcome, enabled: false },
    });
  }

  async enableGoodbye(groupJid: string, message?: string): Promise<void> {
    await serviceManager.groupService.updateGroup(groupJid, {
      goodbye: { enabled: true, message: message || this.DEFAULT_GOODBYE },
    });
  }

  async disableGoodbye(groupJid: string): Promise<void> {
    const group = await serviceManager.groupService.getGroup(groupJid);
    await serviceManager.groupService.updateGroup(groupJid, {
      goodbye: { ...group.goodbye, enabled: false },
    });
  }

  async setWelcomeMessage(groupJid: string, message: string): Promise<void> {
    const group = await serviceManager.groupService.getGroup(groupJid);
    await serviceManager.groupService.updateGroup(groupJid, {
      welcome: { ...group.welcome, message },
    });
  }

  async setGoodbyeMessage(groupJid: string, message: string): Promise<void> {
    const group = await serviceManager.groupService.getGroup(groupJid);
    await serviceManager.groupService.updateGroup(groupJid, {
      goodbye: { ...group.goodbye, message },
    });
  }

  async resetMessages(groupJid: string): Promise<void> {
    await serviceManager.groupService.updateGroup(groupJid, {
      welcome: { enabled: true, message: this.DEFAULT_WELCOME },
      goodbye: { enabled: true, message: this.DEFAULT_GOODBYE },
    });
  }

  public getDefaultWelcome(): string {
    return this.DEFAULT_WELCOME;
  }
  public getDefaultGoodbye(): string {
    return this.DEFAULT_GOODBYE;
  }
  public getDefaultProfilePicPath(): string {
    return this.DEFAULT_PROFILE_PIC;
  }

  async getConfig(groupJid: string): Promise<{ welcome: WelcomeConfig; goodbye: GoodbyeConfig }> {
    const group = await serviceManager.groupService.getGroup(groupJid);
    const welcomeExt = group.welcome as WelcomeConfigExtended;
    return {
      welcome: {
        enabled: group.welcome.enabled,
        message: group.welcome.message || this.DEFAULT_WELCOME,
        useProfilePic: welcomeExt.useProfilePic !== false,
      },
      goodbye: {
        enabled: group.goodbye.enabled,
        message: group.goodbye.message || this.DEFAULT_GOODBYE,
      },
    };
  }
}

export const welcomeService = new WelcomeService();
