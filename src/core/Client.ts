import type { WASocket } from "@whiskeysockets/baileys";
import { commandRegistry } from "./CommandRegistry.js";
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
import { EventEmitter } from "events";

class RealTimeAntiSpam {
  private userMessages = new Map<string, number[]>();
  private userWarnings = new Map<string, number>();
  private bannedUsers = new Set<string>();
  private readonly MAX_MESSAGES_PER_SECOND = 3;
  private readonly MAX_MESSAGES_PER_MINUTE = 20;
  private readonly WARNING_THRESHOLD = 3;
  private readonly BAN_DURATION = 5 * 60 * 1000;

  checkRateLimit(userJid: string): {
    allowed: boolean;
    reason?: string;
    waitTime?: number;
  } {
    if (this.bannedUsers.has(userJid)) {
      return {
        allowed: false,
        reason: "Estás temporalmente bloqueado por spam",
        waitTime: 300000,
      };
    }

    const now = Date.now();
    const userMsgs = this.userMessages.get(userJid) || [];

    const recentMessages = userMsgs.filter((time) => now - time < 60000);

    if (recentMessages.length >= this.MAX_MESSAGES_PER_MINUTE) {
      this.addWarning(userJid);
      return {
        allowed: false,
        reason: "⚠️ Demasiados mensajes. Espera un momento.",
        waitTime: 5000,
      };
    }

    const lastSecondMessages = recentMessages.filter(
      (time) => now - time < 1000,
    );
    if (lastSecondMessages.length >= this.MAX_MESSAGES_PER_SECOND) {
      this.addWarning(userJid);
      return {
        allowed: false,
        reason: "⚠️ Estás escribiendo muy rápido. Cálmate.",
        waitTime: 2000,
      };
    }

    recentMessages.push(now);
    this.userMessages.set(userJid, recentMessages);

    return { allowed: true };
  }

  private addWarning(userJid: string): void {
    const warnings = (this.userWarnings.get(userJid) || 0) + 1;
    this.userWarnings.set(userJid, warnings);

    if (warnings >= this.WARNING_THRESHOLD) {
      this.banUser(userJid);
    }
  }

  private banUser(userJid: string): void {
    this.bannedUsers.add(userJid);
    logger.warn(`🚫 Usuario ${userJid} baneado temporalmente por spam`);

    setTimeout(() => {
      this.bannedUsers.delete(userJid);
      this.userWarnings.delete(userJid);
      logger.info(`✅ Usuario ${userJid} desbaneado`);
    }, this.BAN_DURATION);
  }

  startCleanup(): void {
    setInterval(
      () => {
        const now = Date.now();
        for (const [userJid, messages] of this.userMessages.entries()) {
          const recent = messages.filter((time) => now - time < 60000);
          if (recent.length === 0) {
            this.userMessages.delete(userJid);
          } else {
            this.userMessages.set(userJid, recent);
          }
        }
      },
      5 * 60 * 1000,
    );
  }
}

class PermissionsCache {
  private cache = new Map<
    string,
    {
      userPermissions: Map<string, any>;
      botPermissions: any;
      timestamp: number;
    }
  >();

  private readonly TTL = 3 * 60 * 1000;

  get(groupJid: string, userJid: string): any | null {
    const group = this.cache.get(groupJid);
    if (!group) return null;

    if (Date.now() - group.timestamp > this.TTL) {
      this.cache.delete(groupJid);
      return null;
    }

    return {
      userPerms: group.userPermissions.get(userJid),
      botPerms: group.botPermissions,
    };
  }

  set(groupJid: string, userJid: string, userPerms: any, botPerms: any): void {
    if (!this.cache.has(groupJid)) {
      this.cache.set(groupJid, {
        userPermissions: new Map(),
        botPermissions: botPerms,
        timestamp: Date.now(),
      });
    }

    const group = this.cache.get(groupJid)!;
    group.userPermissions.set(userJid, userPerms);
    group.botPermissions = botPerms;
    group.timestamp = Date.now();
  }

  invalidate(groupJid?: string): void {
    if (groupJid) {
      this.cache.delete(groupJid);
    } else {
      this.cache.clear();
    }
  }
}

class RealTimeMessageProcessor extends EventEmitter {
  private processing = new Set<string>();
  private processedRecently = new Map<string, number>();
  private readonly DUPLICATE_WINDOW = 1000;
  private queue: Array<{ id: string; handler: () => Promise<void> }> = [];
  private isProcessingQueue = false;

  async process(
    messageId: string,
    handler: () => Promise<void>,
  ): Promise<boolean> {
    const lastProcessed = this.processedRecently.get(messageId);
    if (lastProcessed && Date.now() - lastProcessed < this.DUPLICATE_WINDOW) {
      return false;
    }

    if (this.processing.has(messageId)) {
      return false;
    }

    this.queue.push({ id: messageId, handler });
    this.processQueue();

    return true;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.queue.length === 0) return;

    this.isProcessingQueue = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      this.processing.add(item.id);

      try {
        await item.handler();
        this.processedRecently.set(item.id, Date.now());
        this.emit("processed", item.id);
      } catch (error) {
        this.emit("error", item.id, error);
      } finally {
        this.processing.delete(item.id);
      }
    }

    this.isProcessingQueue = false;

    if (this.processedRecently.size > 100) {
      const now = Date.now();
      for (const [id, time] of this.processedRecently.entries()) {
        if (now - time > this.DUPLICATE_WINDOW) {
          this.processedRecently.delete(id);
        }
      }
    }
  }

  getStats() {
    return {
      processing: this.processing.size,
      queued: this.queue.length,
      recentlyProcessed: this.processedRecently.size,
    };
  }
}

export class WhatsAppClient {
  private sock!: WASocket;
  private readonly middlewares: IMiddleware[] = [];
  private readonly authManager: AuthManager;
  private isReady = false;

  private messageProcessor = new RealTimeMessageProcessor();
  private antiSpam = new RealTimeAntiSpam();
  private permsCache = new PermissionsCache();

  private stats = {
    messagesReceived: 0,
    messagesProcessed: 0,
    commandsExecuted: 0,
    errorsCount: 0,
    spamBlocked: 0,
    totalProcessingTime: 0,
    lastStatsLog: Date.now(),
  };

  constructor() {
    this.authManager = new AuthManager();

    this.messageProcessor.on("processed", () => {
      this.stats.messagesProcessed++;
    });

    this.messageProcessor.on("error", (id, error) => {
      this.stats.errorsCount++;
      logError(`Message ${id}`, error);
    });
  }

  async initialize(): Promise<void> {
    logger.info("⚡ Inicializando sistema real-time...");

    const startTime = Date.now();

    await Promise.all([
      serviceManager.initialize(),
      PluginLoader.loadCommands().then((commands) => {
        for (const cmd of commands) {
          if (cmd?.name) {
            commandRegistry.register(cmd);
          }
        }
      }),
    ]);

    logger.info(`✅ Servicios inicializados en ${Date.now() - startTime}ms`);

    AuthManager.showAuthMode();
    logger.info(`📦 ${commandRegistry.size} comandos registrados`);

    this.middlewares.push(
      new AutoRegisterMiddleware(),
      new LoggerMiddleware(),
      new ValidationMiddleware(commandRegistry),
      new PermissionMiddleware(commandRegistry),
      new AntiSpamMiddleware(),
      new CooldownMiddleware(commandRegistry),
    );

    logger.info(`✅ ${this.middlewares.length} middlewares registrados`);

    logger.info("📱 Conectando a WhatsApp...");
    this.sock = await this.authManager.createSocket();
    this.registerSocketListeners();

    this.antiSpam.startCleanup();
    this.startMaintenance();

    this.isReady = true;
    logger.info("✅ Sistema real-time operativo");
  }

  private registerSocketListeners(): void {
    this.sock.ev.on("messages.upsert", ({ messages, type }) => {
      if (type !== "notify") return;

      for (const msg of messages) {
        this.handleMessageRealTime(msg);
      }
    });

    this.sock.ev.on("group-participants.update", (update) => {
      this.handleGroupUpdate(update).catch(() => {});
    });

    this.sock.ev.on("groups.update", (updates) => {
      for (const update of updates) {
        if (update.id) {
          this.permsCache.invalidate(update.id);
        }
      }
    });
  }

  private handleMessageRealTime(message: any): void {
    if (!message?.message || message.key.fromMe) return;

    const messageId = message.key.id;
    if (!messageId) return;

    this.stats.messagesReceived++;

    setImmediate(async () => {
      const startTime = Date.now();

      const processed = await this.messageProcessor.process(
        messageId,
        async () => {
          try {
            const ctx = new MessageContext(this.sock, message);

            if (!ctx.command) return;

            const rateLimit = this.antiSpam.checkRateLimit(ctx.sender.jid);
            if (!rateLimit.allowed) {
              this.stats.spamBlocked++;
              ctx.reply(rateLimit.reason!).catch(() => {});
              return;
            }

            const command = commandRegistry.get(ctx.command);
            if (!command) return;

            if (command.permissions?.user || command.permissions?.bot) {
              if (ctx.chat.isGroup) {
                await this.loadPermissionsFast(ctx);
              } else {
                await ctx.loadSenderPermissions();
              }
            }

            await this.executeWithMiddlewares(ctx, async () => {
              try {
                await command.execute(ctx);
                this.stats.commandsExecuted++;
              } catch (error) {
                this.stats.errorsCount++;
                logError(
                  "Command",
                  new CommandExecutionError(ctx.command, error),
                );
                ctx.reply("❌ Error al ejecutar el comando.").catch(() => {});
              }
            });

            const processingTime = Date.now() - startTime;
            this.stats.totalProcessingTime += processingTime;

            if (processingTime > 500) {
              logger.warn(
                `⚠️ Comando ${ctx.command} tardó ${processingTime}ms`,
              );
            }
          } catch (error) {
            logError("handleMessageRealTime", error);
          }
        },
      );

      if (Date.now() - this.stats.lastStatsLog > 120000) {
        this.logStats();
        this.stats.lastStatsLog = Date.now();
      }
    });
  }

  private async loadPermissionsFast(ctx: MessageContext): Promise<void> {
    const groupJid = ctx.chat.jid;
    const userJid = ctx.sender.jid;

    const cached = this.permsCache.get(groupJid, userJid);
    if (cached && cached.userPerms) {
      ctx.sender.isAdmin = cached.userPerms.isAdmin;
      ctx.chat.isBotAdmin = cached.botPerms.isAdmin;
      return;
    }

    await Promise.all([ctx.loadSenderPermissions(), ctx.loadBotPermissions()]);

    this.permsCache.set(
      groupJid,
      userJid,
      { isAdmin: ctx.sender.isAdmin },
      { isAdmin: ctx.chat.isBotAdmin },
    );
  }

  private async handleGroupUpdate(update: any): Promise<void> {
    const { id: groupJid, participants, action } = update;
    if (!groupJid || !participants) return;

    try {
      this.permsCache.invalidate(groupJid);

      const group = await serviceManager.groupService.getGroup(groupJid);

      if (action === "add" && group.welcome.enabled) {
        for (const participant of participants) {
          const text = (group.welcome.message ?? "¡Bienvenido/a! 👋").replace(
            "@user",
            `@${participant.split("@")[0]}`,
          );

          this.sock
            .sendMessage(groupJid, { text, mentions: [participant] })
            .catch(() => {});
        }
      }

      if (action === "remove" && group.goodbye.enabled) {
        for (const participant of participants) {
          const text = (group.goodbye.message ?? "Adiós @user 👋").replace(
            "@user",
            `@${participant.split("@")[0]}`,
          );

          this.sock
            .sendMessage(groupJid, { text, mentions: [participant] })
            .catch(() => {});
        }
      }
    } catch (error) {
      logError("handleGroupUpdate", error);
    }
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

  private startMaintenance(): void {
    setInterval(
      () => {
        const queueStats = this.messageProcessor.getStats();
        if (queueStats.queued > 10) {
          logger.warn(
            `⚠️ Cola de mensajes grande: ${queueStats.queued} pendientes`,
          );
        }
      },
      5 * 60 * 1000,
    );
  }

  private logStats(): void {
    if (this.stats.messagesReceived === 0) return;

    const avgTime =
      this.stats.messagesProcessed > 0
        ? this.stats.totalProcessingTime / this.stats.messagesProcessed
        : 0;

    const successRate =
      this.stats.commandsExecuted > 0
        ? (
            ((this.stats.commandsExecuted - this.stats.errorsCount) /
              this.stats.commandsExecuted) *
            100
          ).toFixed(1)
        : "100";

    const queueStats = this.messageProcessor.getStats();

    logger.info(
      `📊 Real-Time Stats: ` +
        `${this.stats.messagesReceived} recv, ` +
        `${this.stats.messagesProcessed} proc, ` +
        `${this.stats.commandsExecuted} cmds, ` +
        `${this.stats.spamBlocked} spam⛔, ` +
        `avg ${avgTime.toFixed(0)}ms, ` +
        `queue ${queueStats.queued}, ` +
        `success ${successRate}%`,
    );
  }

  async shutdown(): Promise<void> {
    logger.info("🛑 Cerrando bot...");
    this.isReady = false;

    try {
      this.sock?.ws?.close();
    } catch (_) {}

    await serviceManager.shutdown();
    this.logStats();
    logger.info("Bot cerrado correctamente");
  }

  getRegistry() {
    return commandRegistry;
  }

  getSocket(): WASocket {
    return this.sock;
  }

  isClientReady(): boolean {
    return this.isReady;
  }

  getStats() {
    return {
      ...this.stats,
      avgProcessingTime:
        this.stats.messagesProcessed > 0
          ? this.stats.totalProcessingTime / this.stats.messagesProcessed
          : 0,
      queue: this.messageProcessor.getStats(),
      spamBlockRate:
        this.stats.messagesReceived > 0
          ? (
              (this.stats.spamBlocked / this.stats.messagesReceived) *
              100
            ).toFixed(2) + "%"
          : "0%",
    };
  }
}
