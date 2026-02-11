import type { WASocket } from "@whiskeysockets/baileys";
import { CommandRegistry } from "./CommandRegistry.js";
import { PluginLoader } from "./PluginLoader.js";
import { MessageContext } from "./MessageContext.js";
import { AuthManager } from "./AuthManager.js";
import { CooldownMiddleware } from "@/middlewares/CooldownMiddleware.js";
import { AutoRegisterMiddleware } from "@/middlewares/AutoRegisterMiddleware.js";
import { ValidationMiddleware } from "@/middlewares/ValidationMiddleware.js";
import { PermissionMiddleware } from "@/middlewares/PermissionMiddleware.js";
import { LoggerMiddleware } from "@/middlewares/LoggerMiddleware.js";
import { AntiSpamMiddleware } from "@/middlewares/AntiSpamMiddleware.js";
import { serviceManager } from "@/services/Servicemanager.js";
import { logger, logError } from "@/utils/logger.js";
import { CommandExecutionError } from "@/utils/errors.js";
import type { IMiddleware } from "@/types/index.js";

export class WhatsAppClient {
  private sock!: WASocket;
  private readonly registry: CommandRegistry;
  private readonly middlewares: IMiddleware[] = [];
  private readonly authManager: AuthManager;
  private isReady = false;

  constructor() {
    this.registry = new CommandRegistry();
    this.authManager = new AuthManager();
  }

  async initialize(): Promise<void> {
    logger.info("Inicializando servicios y comandos en paralelo...");

    const [, commands] = await Promise.all([
      serviceManager.initialize(),
      PluginLoader.loadCommands(),
    ]);

    AuthManager.showAuthMode();

    if (commands.length === 0) {
      logger.warn("⚠️  No se cargaron comandos");
    }

    for (const cmd of commands) {
      if (cmd?.name) this.registry.register(cmd);
    }

    logger.info(`✅ ${commands.length} comandos cargados`);

    this.middlewares.push(
      new AutoRegisterMiddleware(),
      new LoggerMiddleware(),
      new ValidationMiddleware(this.registry),
      new PermissionMiddleware(this.registry),
      new AntiSpamMiddleware(),
      new CooldownMiddleware(this.registry),
    );

    logger.info(`✅ ${this.middlewares.length} middlewares registrados`);
    logger.info("📱 Conectando a WhatsApp...");

    this.sock = await this.authManager.createSocket();
    this.registerSocketListeners();

    this.isReady = true;
    logger.info("✅ Cliente inicializado correctamente");
  }

  private registerSocketListeners(): void {
    this.sock.ev.on("messages.upsert", ({ messages, type }) => {
      if (type !== "notify") return;
      for (const msg of messages) {
        this.handleMessage(msg).catch((err) => logError("handleMessage", err));
      }
    });

    this.sock.ev.on("group-participants.update", (update) => {
      this.handleGroupUpdate(update).catch((err) =>
        logError("handleGroupUpdate", err),
      );
    });
  }

  private async handleMessage(message: any): Promise<void> {
    if (!message?.message || message.key.fromMe) return;

    const ctx = new MessageContext(this.sock, message);
    if (!ctx.command) return;

    const command = this.registry.get(ctx.command);
    if (!command) return;

    if (command.permissions?.user || command.permissions?.bot) {
      await Promise.all([
        ctx.loadSenderPermissions(),
        ctx.chat.isGroup ? ctx.loadBotPermissions() : Promise.resolve(),
      ]);
    }

    await this.executeWithMiddlewares(ctx, async () => {
      try {
        await command.execute(ctx);
      } catch (error) {
        logError("Command", new CommandExecutionError(ctx.command, error));
        try {
          await ctx.reply("❌ Error al ejecutar el comando. Intenta de nuevo.");
        } catch (_) {
          // ignorar error al responder
        }
      }
    });
  }

  private async handleGroupUpdate(update: any): Promise<void> {
    const { id: groupJid, participants, action } = update;
    if (!groupJid || !participants) return;

    const group = await serviceManager.groupService.getGroup(groupJid);
    const sends: Promise<any>[] = [];

    if (action === "add" && group.welcome.enabled) {
      for (const participant of participants) {
        const text = (
          group.welcome.message ?? "¡Bienvenido/a al grupo! 👋"
        ).replace("@user", `@${participant.split("@")[0]}`);
        sends.push(
          this.sock.sendMessage(groupJid, { text, mentions: [participant] }),
        );
      }
    }

    if (action === "remove" && group.goodbye.enabled) {
      for (const participant of participants) {
        const text = (
          group.goodbye.message ?? "Adiós @user, esperamos verte pronto 👋"
        ).replace("@user", `@${participant.split("@")[0]}`);
        sends.push(
          this.sock.sendMessage(groupJid, { text, mentions: [participant] }),
        );
      }
    }

    if (sends.length > 0) await Promise.all(sends);
  }

  private async executeWithMiddlewares(
    ctx: MessageContext,
    handler: () => Promise<void>,
  ): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        try {
          await middleware.execute(ctx, next);
        } catch (error) {
          logError(`Middleware:${middleware.name}`, error);
          throw error;
        }
      } else {
        await handler();
      }
    };

    await next();
  }

  async shutdown(): Promise<void> {
    logger.info("🛑 Cerrando bot...");
    this.isReady = false;

    try {
      this.sock?.ws?.close();
    } catch (_) {
      // ignorar error al cerrar WebSocket
    }

    await serviceManager.shutdown();
    logger.info("✅ Bot cerrado correctamente");
  }

  getRegistry(): CommandRegistry {
    return this.registry;
  }

  getSocket(): WASocket {
    return this.sock;
  }

  isClientReady(): boolean {
    return this.isReady;
  }
}
