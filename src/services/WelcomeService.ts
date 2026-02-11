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

export class WelcomeService {
  private readonly DEFAULT_PROFILE_PIC = "./data/assets/logo.png";

  private readonly DEFAULT_WELCOME = `
✧･ﾟ:*  𝙚𝙮, 𝙣𝙪𝙚𝙫𝙖 𝙘𝙖𝙧𝙖  *:･ﾟ✧
.・✦──── ⋆⋅☆⋅⋆ ────✦・.

qué onda @user

ya estás en @group  
ahora somos @count

soy VaniaBot, la que anda por aquí echando ojo al rollo

reglas rápidas:
- respeto pa’ todos
- nada de spam que ya me da flojera
- si vienes con mala onda… mejor ni lo intentes

espero que la pases chido y te quedes un rato

.・✦──── ⋆⋅☆⋅⋆ ────✦・.
✧･ﾟ:*  𝙑𝙖𝙣𝙞𝙖𝘽𝙤𝙩  *:･ﾟ✧
  `.trim();

  private readonly DEFAULT_GOODBYE = `
✧･ﾟ:*  𝙎𝙚 𝙡@ 𝙡𝙡𝙚𝙫@ 𝙡𝙖 𝙫𝙚𝙧𝙜𝙖  *:･ﾟ✧
.・✦──── ⋆⋅☆⋅⋆ ────✦・.
╰┈➤

@user dijo adiós

qué pendejada la neta

.・✦──── ⋆⋅ ───── ⋆⋅ ─────✦・.

@count seguimos aquí  
sin llorones

yo estoy más que bien  
next

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
        return;
      }

      const metadata = await sock.groupMetadata(groupJid);

      const message = this.parseMessage(
        group.welcome.message || this.DEFAULT_WELCOME,
        {
          user: userJid.split("@")[0],
          group: metadata.subject,
          desc: metadata.desc || "Sin descripción",
          count: metadata.participants.length.toString(),
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
          }
        } catch {
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
        await sock.sendMessage(groupJid, {
          text: message,
          mentions: [userJid],
        });
      }

      logger.info(`Bienvenida enviada a ${userJid} en ${groupJid}`);
    } catch (error) {
      logError("Error enviando bienvenida:", error);
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
        },
      );

      await sock.sendMessage(groupJid, {
        text: message,
        mentions: [userJid],
      });

      logger.info(`Despedida enviada para ${userJid} en ${groupJid}`);
    } catch (error) {
      logError("Error enviando despedida:", error);
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
    const group = await serviceManager.groupService.getGroup(groupJid);

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
      welcome: {
        ...group.welcome,
        enabled: false,
      },
    });
  }

  async enableGoodbye(groupJid: string, message?: string): Promise<void> {
    const group = await serviceManager.groupService.getGroup(groupJid);

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
      goodbye: {
        ...group.goodbye,
        enabled: false,
      },
    });
  }

  async setWelcomeMessage(groupJid: string, message: string): Promise<void> {
    const group = await serviceManager.groupService.getGroup(groupJid);

    await serviceManager.groupService.updateGroup(groupJid, {
      welcome: {
        ...group.welcome,
        message,
      },
    });
  }

  async setGoodbyeMessage(groupJid: string, message: string): Promise<void> {
    const group = await serviceManager.groupService.getGroup(groupJid);

    await serviceManager.groupService.updateGroup(groupJid, {
      goodbye: {
        ...group.goodbye,
        message,
      },
    });
  }

  async resetMessages(groupJid: string): Promise<void> {
    await serviceManager.groupService.updateGroup(groupJid, {
      welcome: {
        enabled: true,
        message: this.DEFAULT_WELCOME,
      },
      goodbye: {
        enabled: true,
        message: this.DEFAULT_GOODBYE,
      },
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
