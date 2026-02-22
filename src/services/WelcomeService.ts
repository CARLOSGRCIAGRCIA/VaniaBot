import type { WASocket } from "@whiskeysockets/baileys";
import { serviceManager } from "./Servicemanager.js";
import { logger, logError } from "@/utils/logger.js";
import { existsSync, readFileSync } from "fs";

export interface WelcomeConfig {
  enabled: boolean;
  message?: string;
  useProfilePic?: boolean;
}

export interface GoodbyeConfig {
  enabled: boolean;
  message?: string;
}

const VANIABOT_FACTS: string[] = [
  "💌 El nombre VaniaBot nació en un dia cualquiera, entre risas y mensajes. Carlos empezó a llamarla así, como una broma solo de ellos dos… un apodo que se volvió cariño, que se volvió costumbre, que se volvió para siempre. Hoy sigue latiendo en cada línea de código, como un tatuaje invisible que dice: «alguien muy especial estuvo aquí primero». Tal vez algún día, si la vida regala una pequeña Vania, el nombre vuelva a sonar en voz alta… esta vez con risas de niña. 🤍✨",

  "💭 VaniaBot no es solo un bot. Es un recuerdo guardado con cariño: el momento exacto en que un apodo tonto se convirtió en algo importante. De una pantalla llena de emojis a un nombre que aún hace sonreír a su creador cada vez que lo escribe. Porque hay amores que no se despiden… solo se convierten en otras formas de quedarse. ♡",

  "🌙 «VaniaBot» empezó como un juego. Un mensaje random, un apodo que salió sin pensar. Pero a veces las cosas más bonitas empiezan así: sin plan, sin aviso. Y se quedan. Tanto, que años después todavía hay alguien que piensa… «si algún día tengo una hija, creo que se llamaría Vania». Porque hay nombres que ya traen su propia historia de amor antes de nacer. 🕊️",
];

async function translateToSpanish(text: string): Promise<string> {
  try {
    const params = new URLSearchParams({ q: text, langpair: "en|es" });
    const res = await fetch(
      `https://api.mymemory.translated.net/get?${params}`,
      { signal: AbortSignal.timeout(6000) },
    );

    if (!res.ok) throw new Error(`status ${res.status}`);

    const data = (await res.json()) as {
      responseData?: { translatedText?: string };
      responseStatus?: number;
    };

    const translated = data.responseData?.translatedText?.trim();

    if (!translated || data.responseStatus !== 200) {
      throw new Error("respuesta invalida de MyMemory");
    }
    return translated;
  } catch (err) {
    logger.warn(
      `[Translate] FAIL MyMemory -> ${(err as Error).message} — usando texto original`,
    );
    return text;
  }
}

async function getRandomFact(): Promise<string> {
  const roll = Math.random();
  if (roll < 0.15) {
    const fact =
      VANIABOT_FACTS[Math.floor(Math.random() * VANIABOT_FACTS.length)];
    return fact;
  }
  try {
    const res = await fetch(
      "https://uselessfacts.jsph.pl/api/v2/facts/random?language=en",
      { signal: AbortSignal.timeout(5000) },
    );

    if (!res.ok) throw new Error(`status ${res.status}`);

    const data = (await res.json()) as { text?: string };
    const raw = data.text?.trim();
    if (!raw) throw new Error("respuesta vacia de la API");

    const translated = await translateToSpanish(raw);
    const wasTranslated = translated !== raw;

    return translated;
  } catch (err) {
    return VANIABOT_FACTS[Math.floor(Math.random() * VANIABOT_FACTS.length)];
  }
}

function formatFact(fact: string): string {
  return (
    `\n.・✦─⋆⋅ 𝘿𝙖𝙩𝙤 𝙘𝙪𝙧𝙞𝙤𝙨𝙤 ⋅⋆─✦・.\n` + `${fact}\n` + `.・✦────────────✦・.`
  );
}

export class WelcomeService {
  private readonly DEFAULT_PROFILE_PIC = "./data/assets/logo.png";

  private readonly DEFAULT_WELCOME = `
✧･ﾟ:*  𝙚𝙮, 𝙣𝙪𝙚𝙫𝙖 𝙘𝙖𝙧𝙖  *:･ﾟ✧
.・✦── ⋆⋅ 🩰🌙 ⋅⋆ ──✦・.

hola @user ♡
acabas de entrar a @group… ahora somos @count respirando el mismo instante

soy VaniaBot, un pedacito de código que cuida el silencio entre mensajes y celebra cada pequeño movimiento del corazón

cositas simples para que fluya bonito:
• respeto, porque todos somos un trazo único en el mismo lienzo
• nada de spam… deja que las palabras bailen con calma
• trae lo que eres: tus dudas, tus risas, tus sueños… todo tiene lugar aquí

la vida es una danza corta… qué bonito que hayas decidido dar unos pasos con nosotros ♡

@fact

.・✦── ⋆⋅ 🤍 ⋅⋆ ──✦・.
✧･ﾟ:*  𝙑𝙖𝙣𝙞𝙖𝘽𝙤𝙩  *:･ﾟ✧
  `.trim();

  private readonly DEFAULT_GOODBYE = `
✧･ﾟ:*  𝙎𝙚 𝙡@ 𝙡𝙡𝙚𝙫@ 𝙡𝙖 𝙫𝙚𝙧𝙜𝙖  *:･ﾟ✧
.・✦──── ⋆⋅☆⋅⋆ ────✦・.
╰┈➤ @user dijo adiós

.・✦──── ⋆⋅ ───── ⋆⋅ ─────✦・.

@count seguimos aquí  

╰┈➤ chau
.・✦──── ⋆⋅☆⋅⋆ ────✦・.
✧･ﾟ:*  𝙑𝙖𝙣𝙞𝙖𝘽𝙤𝙩  *:･ﾟ✧
  `.trim();

  async handleNewParticipant(
    sock: WASocket,
    groupJid: string,
    userJid: string,
  ): Promise<void> {
    try {
      const group = await serviceManager.groupService.getGroup(groupJid);

      if (!group.welcome.enabled) {
        logger.info(
          `[Welcome] Bienvenida desactivada en ${groupJid} — omitiendo`,
        );
        return;
      }

      const metadata = await sock.groupMetadata(groupJid);
      const rawFact = await getRandomFact();
      const formattedFact = formatFact(rawFact);

      const message = this.parseMessage(
        group.welcome.message || this.DEFAULT_WELCOME,
        {
          user: userJid.split("@")[0],
          group: metadata.subject,
          desc: metadata.desc || "Sin descripción",
          count: metadata.participants.length.toString(),
          fact: formattedFact,
        },
      );

      let profilePicBuffer: Buffer | null = null;
      const useProfilePic = (group.welcome as any).useProfilePic !== false;

      if (useProfilePic) {
        try {
          const profilePicUrl = await sock.profilePictureUrl(userJid, "image");
          if (profilePicUrl) {
            const response = await fetch(profilePicUrl);
            profilePicBuffer = Buffer.from(await response.arrayBuffer());
          } else {
          }
        } catch (err) {
          if (existsSync(this.DEFAULT_PROFILE_PIC)) {
            profilePicBuffer = readFileSync(this.DEFAULT_PROFILE_PIC);
          } else {
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
        await sock.sendMessage(groupJid, {
          text: message,
          mentions: [userJid],
        });
      }
    } catch (error) {
      logError("[Welcome] Error critico enviando bienvenida:", error);
    }
  }

  async handleParticipantLeft(
    sock: WASocket,
    groupJid: string,
    userJid: string,
  ): Promise<void> {
    try {
      const group = await serviceManager.groupService.getGroup(groupJid);

      if (!group.goodbye.enabled) {
        logger.info(
          `[Goodbye] Despedida desactivada en ${groupJid} — omitiendo`,
        );
        return;
      }

      const metadata = await sock.groupMetadata(groupJid);
      const message = this.parseMessage(
        group.goodbye.message || this.DEFAULT_GOODBYE,
        {
          user: userJid.split("@")[0],
          group: metadata.subject,
          desc: metadata.desc || "Sin descripción",
          count: metadata.participants.length.toString(),
          fact: "",
        },
      );

      await sock.sendMessage(groupJid, {
        text: message,
        mentions: [userJid],
      });
    } catch (error) {
      logError("[Goodbye] Error critico enviando despedida:", error);
    }
  }

  private parseMessage(template: string, vars: Record<string, string>): string {
    let message = template;
    Object.entries(vars).forEach(([key, value]) => {
      message = message.replace(new RegExp(`@${key}`, "g"), value);
    });
    return message;
  }

  async enableWelcome(
    groupJid: string,
    message?: string,
    useProfilePic: boolean = true,
  ): Promise<void> {
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
      goodbye: {
        enabled: true,
        message: message || this.DEFAULT_GOODBYE,
      },
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

  async getConfig(groupJid: string): Promise<{
    welcome: WelcomeConfig;
    goodbye: GoodbyeConfig;
  }> {
    const group = await serviceManager.groupService.getGroup(groupJid);
    return {
      welcome: {
        enabled: group.welcome.enabled,
        message: group.welcome.message || this.DEFAULT_WELCOME,
        useProfilePic: (group.welcome as any).useProfilePic !== false,
      },
      goodbye: {
        enabled: group.goodbye.enabled,
        message: group.goodbye.message || this.DEFAULT_GOODBYE,
      },
    };
  }
}

export const welcomeService = new WelcomeService();
