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
import { cacheManager } from "@/core/CacheManager.js";
import { aiService } from "@/services/external/AIService.js";
import type { IMiddleware } from "@/types/index.js";
import { EventEmitter } from "events";

class RealTimeAntiSpam {
  private userMessages = new Map<string, number[]>();
  private bannedUsers = new Set<string>();
  private readonly MAX_MESSAGES_PER_SECOND = 3;
  private readonly MAX_MESSAGES_PER_MINUTE = 20;
  private readonly BAN_DURATION = 5 * 60 * 1000;

  checkRateLimit(userJid: string): {
    allowed: boolean;
    reason?: string;
    waitTime?: number;
  } {
    if (this.bannedUsers.has(userJid)) {
      return {
        allowed: false,
        reason: "⛔ Bloqueado temporalmente por spam",
        waitTime: 300000,
      };
    }

    const now = Date.now();
    const userMsgs = this.userMessages.get(userJid) || [];
    const recentMessages = userMsgs.filter((time) => now - time < 60000);

    if (recentMessages.length >= this.MAX_MESSAGES_PER_MINUTE) {
      this.banUser(userJid);
      return {
        allowed: false,
        reason: "⚠️ Demasiados mensajes. Bloqueado 5 minutos.",
        waitTime: 300000,
      };
    }

    const lastSecondMessages = recentMessages.filter(
      (time) => now - time < 1000,
    );
    if (lastSecondMessages.length >= this.MAX_MESSAGES_PER_SECOND) {
      return {
        allowed: false,
        reason: "⚠️ Estás escribiendo muy rápido",
        waitTime: 2000,
      };
    }

    recentMessages.push(now);
    this.userMessages.set(userJid, recentMessages);
    return { allowed: true };
  }

  private banUser(userJid: string): void {
    this.bannedUsers.add(userJid);
    setTimeout(() => this.bannedUsers.delete(userJid), this.BAN_DURATION);
  }

  startCleanup(): void {
    setInterval(
      () => {
        const now = Date.now();
        for (const [userJid, messages] of this.userMessages.entries()) {
          const recent = messages.filter((time) => now - time < 60000);
          if (recent.length === 0) this.userMessages.delete(userJid);
          else this.userMessages.set(userJid, recent);
        }
      },
      5 * 60 * 1000,
    );
  }
}

class RealTimeMessageProcessor extends EventEmitter {
  private processing = new Set<string>();
  private queue: Array<{ id: string; handler: () => Promise<void> }> = [];
  private isProcessingQueue = false;

  async process(
    messageId: string,
    handler: () => Promise<void>,
  ): Promise<boolean> {
    if (this.processing.has(messageId)) return false;
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
        this.emit("processed", item.id);
      } catch (error) {
        this.emit("error", item.id, error);
      } finally {
        this.processing.delete(item.id);
      }
    }

    this.isProcessingQueue = false;
  }

  getStats() {
    return { processing: this.processing.size, queued: this.queue.length };
  }
}

interface MiddlewareConfig {
  middleware: IMiddleware;
  priority: number;
  canRunParallel: boolean;
}

export class WhatsAppClient {
  private sock!: WASocket;
  private readonly middlewares: MiddlewareConfig[] = [];
  private readonly authManager: AuthManager;
  private isReady = false;
  private messageProcessor = new RealTimeMessageProcessor();
  private antiSpam = new RealTimeAntiSpam();
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
    const startTime = Date.now();

    await Promise.all([
      serviceManager.initialize(),
      PluginLoader.loadCommands().then((commands) => {
        for (const cmd of commands) {
          if (cmd?.name) commandRegistry.register(cmd);
        }
      }),
    ]);

    if (process.env.NODE_ENV !== "production") {
      logger.info(`Servicios: ${Date.now() - startTime}ms`);
      logger.info(`Comandos: ${commandRegistry.size}`);
    }

    AuthManager.showAuthMode();

    this.middlewares.push(
      {
        middleware: new AutoRegisterMiddleware(),
        priority: 1,
        canRunParallel: false,
      },
      { middleware: new LoggerMiddleware(), priority: 2, canRunParallel: true },
      {
        middleware: new ValidationMiddleware(commandRegistry),
        priority: 3,
        canRunParallel: true,
      },
      {
        middleware: new PermissionMiddleware(commandRegistry),
        priority: 4,
        canRunParallel: false,
      },
      {
        middleware: new AntiSpamMiddleware(),
        priority: 5,
        canRunParallel: false,
      },
      {
        middleware: new CooldownMiddleware(commandRegistry),
        priority: 6,
        canRunParallel: false,
      },
    );

    this.middlewares.sort((a, b) => a.priority - b.priority);

    this.sock = await this.authManager.createSocket();
    this.registerSocketListeners();
    this.antiSpam.startCleanup();
    this.startMaintenance();
    this.isReady = true;
  }

  private registerSocketListeners(): void {
    this.sock.ev.on("messages.upsert", ({ messages, type }) => {
      if (type !== "notify") return;
      for (const msg of messages) this.handleMessageRealTime(msg);
    });

    this.sock.ev.on("group-participants.update", (update) => {
      this.handleGroupUpdate(update).catch(() => {});
    });

    this.sock.ev.on("groups.update", (updates) => {
      for (const update of updates) {
        if (update.id) cacheManager.invalidateGroupMetadata(update.id);
      }
    });
  }

  private handleMessageRealTime(message: any): void {
    if (!message?.message || message.key.fromMe) return;

    const messageId = message.key.id;
    if (!messageId) return;
    if (cacheManager.hasProcessedMessage(messageId)) return;

    this.stats.messagesReceived++;

    setImmediate(async () => {
      const startTime = Date.now();

      await this.messageProcessor.process(messageId, async () => {
        try {
          const ctx = new MessageContext(this.sock, message);

          if (ctx.chat.isGroup && !ctx.command) {
            const botJid = this.sock.user?.id ?? "";
            await this.handleAiMention(ctx, botJid);
            cacheManager.markMessageProcessed(messageId);
            return;
          }

          if (!ctx.command) {
            cacheManager.markMessageProcessed(messageId);
            return;
          }

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
              await Promise.all([
                ctx.loadSenderPermissions(),
                ctx.loadBotPermissions(),
              ]);
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
              ctx.reply("Error al ejecutar el comando.").catch(() => {});
            }
          });

          cacheManager.markMessageProcessed(messageId);

          const processingTime = Date.now() - startTime;
          this.stats.totalProcessingTime += processingTime;
          if (processingTime > 500)
            logger.warn(`⚠️ ${ctx.command}: ${processingTime}ms`);
        } catch (error) {
          logError("handleMessageRealTime", error);
        }
      });

      if (Date.now() - this.stats.lastStatsLog > 300000) {
        this.logStats();
        this.stats.lastStatsLog = Date.now();
      }
    });
  }

  private async handleAiMention(
    ctx: MessageContext,
    botJid: string,
  ): Promise<boolean> {
    const rawText = ctx.text ?? "";
    const msgContent = ctx.message.message;

    const mentionedJids: string[] =
      msgContent?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];

    const botNumber = botJid.split("@")[0].split(":")[0];

    const botMentioned =
      mentionedJids.some((jid: string) => jid.startsWith(botNumber)) ||
      rawText.toLowerCase().includes("@vania") ||
      /^vania[,:\s]/i.test(rawText);

    if (!botMentioned) return false;

    const cleanText = rawText
      .replace(/@\d+/g, "")
      .replace(/@vania/gi, "")
      .replace(/^vania[,:\s]*/i, "")
      .trim();

    if (!cleanText) {
      await ctx.reply(
        "¿Me llamaste? 👀 Dime qué necesitas o usa *!ai <mensaje>* para chatear.",
      );
      return true;
    }

    await ctx.react("🤔");

    const response = await aiService.chat(
      ctx.chat.jid,
      ctx.sender.jid,
      cleanText,
      true,
    );

    if (!response.success) {
      await ctx.react("❌");
      await ctx.reply(`❌ ${response.error}`);
      return true;
    }

    await ctx.react("✅");
    await ctx.reply(response.text!);
    return true;
  }

  private async handleGroupUpdate(update: any): Promise<void> {
    const { id: groupJid, participants, action } = update;
    if (!groupJid || !participants) return;

    try {
      cacheManager.invalidateGroupMetadata(groupJid);
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
      const parallelBatch: IMiddleware[] = [];

      while (
        index < this.middlewares.length &&
        this.middlewares[index].canRunParallel
      ) {
        parallelBatch.push(this.middlewares[index].middleware);
        index++;
      }

      if (parallelBatch.length > 0) {
        await Promise.all(
          parallelBatch.map((mw) => mw.execute(ctx, async () => {})),
        );
      }

      if (index < this.middlewares.length) {
        const config = this.middlewares[index++];
        try {
          await config.middleware.execute(ctx, next);
        } catch (error) {
          logError(`Middleware:${config.middleware.name}`, error);
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
        if (queueStats.queued > 20)
          logger.warn(`⚠️ Cola: ${queueStats.queued} mensajes pendientes`);
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
    const queueStats = this.messageProcessor.getStats();
    const cacheStats = cacheManager.getStats();
    logger.info(
      `${this.stats.messagesReceived} recv | ` +
        `${this.stats.commandsExecuted} cmds | ` +
        `${this.stats.spamBlocked}⛔ | ` +
        `${avgTime.toFixed(0)}ms avg | ` +
        `queue ${queueStats.queued} | ` +
        `cache ${cacheStats.hitRate}`,
    );
  }

  async shutdown(): Promise<void> {
    this.isReady = false;
    try {
      this.sock?.ws?.close();
    } catch (_) {}
    await serviceManager.shutdown();
    this.logStats();
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
      cache: cacheManager.getStats(),
    };
  }
}
