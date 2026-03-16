/**
 * Client.ts
 *
 * Main WhatsApp client that handles message processing, middleware execution,
 * and event management for the bot.
 *
 * @author **Carlos G** ⭐
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import type { WASocket, WAMessage, proto, BaileysEventMap } from '@whiskeysockets/baileys';
import { commandRegistry } from './CommandRegistry.js';
import { pluginLoader } from './PluginLoader.js';
import { MessageContext } from './MessageContext.js';
import { AuthManager } from './AuthManager.js';
import { config } from '@/config/index.js';
import { CooldownMiddleware } from '@/middlewares/CooldownMiddleware.js';
import { AutoRegisterMiddleware } from '@/middlewares/AutoRegisterMiddleware.js';
import { ValidationMiddleware } from '@/middlewares/ValidationMiddleware.js';
import { PermissionMiddleware } from '@/middlewares/PermissionMiddleware.js';
import { LoggerMiddleware } from '@/middlewares/LoggerMiddleware.js';
import { AntiSpamMiddleware } from '@/middlewares/AntiSpamMiddleware.js';
import { MuteMiddleware } from '@/middlewares/MuteMiddleware.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { logger, logError } from '@/utils/logger.js';
import { CommandExecutionError } from '@/utils/errors.js';
import { cacheManager } from '@/core/CacheManager.js';
import { handleReaccion } from '@/handlers/ReaccionHandler.js';
import { quizAnswerHandler } from '@/handlers/QuizAnswerHandler.js';
import { handleMention } from '@/handlers/AiMentionHandler.js';
import type { IMiddleware } from '@/types/index.js';
import { EventEmitter } from 'events';
import { welcomeService } from '@/services/system/WelcomeService.js';
import { subBotManager } from '@/services/subbot/SubBotManager.js';
import { rateLimitService } from '@/services/system/RateLimitService.js';

interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  waitTime?: number;
}

type GroupParticipantsUpdate = BaileysEventMap['group-participants.update'];

declare global {
  var client: WhatsAppClient | undefined;
}

/**
 * Real-time anti-spam system that tracks user message rates.
 * Bans users who exceed message limits.
 */
class RealTimeAntiSpam {
  private userMessages = new Map<string, number[]>();
  private bannedUsers = new Set<string>();
  private readonly MAX_MESSAGES_PER_SECOND = 3;
  private readonly MAX_MESSAGES_PER_MINUTE = 20;
  private readonly BAN_DURATION = 5 * 60 * 1000;

  checkRateLimit(userJid: string): RateLimitResult {
    if (this.bannedUsers.has(userJid)) {
      return { allowed: false, reason: '⛔ Bloqueado temporalmente por spam', waitTime: 300000 };
    }

    const now = Date.now();
    const userMsgs = this.userMessages.get(userJid) ?? [];
    const recentMessages = userMsgs.filter(time => now - time < 60000);

    if (recentMessages.length >= this.MAX_MESSAGES_PER_MINUTE) {
      this.banUser(userJid);
      return {
        allowed: false,
        reason: '⚠️ Demasiados mensajes. Bloqueado 5 minutos.',
        waitTime: 300000,
      };
    }

    const lastSecondMessages = recentMessages.filter(time => now - time < 1000);
    if (lastSecondMessages.length >= this.MAX_MESSAGES_PER_SECOND) {
      return { allowed: false, reason: '⚠️ Estás escribiendo muy rápido', waitTime: 2000 };
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
          const recent = messages.filter(time => now - time < 60000);
          if (recent.length === 0) this.userMessages.delete(userJid);
          else this.userMessages.set(userJid, recent);
        }
      },
      5 * 60 * 1000,
    );
  }
}

/**
 * Processes messages in real-time with queue management.
 * Prevents duplicate processing of messages.
 */
class RealTimeMessageProcessor extends EventEmitter {
  private processing = new Set<string>();
  private queue: Array<{ id: string; handler: () => Promise<void> }> = [];
  private isProcessingQueue = false;

  async process(messageId: string, handler: () => Promise<void>): Promise<boolean> {
    if (this.processing.has(messageId)) return false;
    this.queue.push({ id: messageId, handler });
    // processQueue errors surface via the inherited 'error' EventEmitter event
    this.processQueue().catch(err => this.emit('error', messageId, err));
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
        this.emit('processed', item.id);
      } catch (error) {
        this.emit('error', item.id, error);
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

/**
 * Main WhatsApp client class.
 * Handles initialization, message processing, middleware execution, and event listeners.
 */
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
    this.messageProcessor.on('processed', () => {
      this.stats.messagesProcessed++;
    });
    this.messageProcessor.on('error', (id: string, error: unknown) => {
      this.stats.errorsCount++;
      logError(`Message ${id}`, error);
    });
  }

  async initialize(): Promise<void> {
    const startTime = Date.now();

    await Promise.all([
      serviceManager.initialize(),
      pluginLoader.loadCommands().then(commands => {
        logger.debug(`🔄 Registering ${commands.length} commands...`);
        for (const cmd of commands) {
          if (cmd?.name) {
            logger.debug(`📝 Registering command: ${cmd.name}`);
            commandRegistry.register(cmd);
          }
        }
        logger.info(`✅ Registered commands: ${commandRegistry.size}`);
      }),
    ]);

    if (process.env.NODE_ENV !== 'production') {
      logger.info(`Servicios: ${Date.now() - startTime}ms`);
      logger.info(`Comandos: ${commandRegistry.size}`);
    }

    try {
      const { aiService } = await import('@/services/external/AIService.js');
      await aiService.initialize();
    } catch {
      logger.warn('AI Service not available (GROQ_API_KEY may be missing)');
    }

    AuthManager.showAuthMode();

    this.middlewares.push(
      { middleware: new AutoRegisterMiddleware(), priority: 1, canRunParallel: false },
      { middleware: new MuteMiddleware(), priority: 2, canRunParallel: false },
      { middleware: new LoggerMiddleware(), priority: 3, canRunParallel: true },
      { middleware: new ValidationMiddleware(commandRegistry), priority: 4, canRunParallel: true },
      { middleware: new PermissionMiddleware(commandRegistry), priority: 5, canRunParallel: false },
      { middleware: new AntiSpamMiddleware(), priority: 6, canRunParallel: false },
      { middleware: new CooldownMiddleware(commandRegistry), priority: 7, canRunParallel: false },
    );

    this.middlewares.sort((a, b) => a.priority - b.priority);

    this.sock = await this.authManager.createSocket();
    subBotManager.setMainSocket(this.sock);
    await subBotManager.initialize();
    this.registerSocketListeners();
    this.antiSpam.startCleanup();
    this.startMaintenance();
    this.isReady = true;
  }

  private registerSocketListeners(): void {
    this.sock.ev.on('messages.upsert', ({ messages, type }) => {
      logger.debug(`📥 Messages upsert: type=${type}, count=${messages.length}`);
      if (type !== 'notify') {
        logger.debug('Ignoring non-notify message');
        return;
      }

      for (const msg of messages) {
        logger.debug(`📨 Processing msg: from=${msg.key.remoteJid}, fromMe=${msg.key.fromMe}`);

        if (msg.message?.reactionMessage) {
          handleReaccion(this.sock, msg).catch(err => logError('handleReaccion', err));
          continue;
        }
        this.handleMessageRealTime(msg);
      }
    });

    this.sock.ev.on('group-participants.update', update => {
      void this.handleGroupUpdate(update);
    });

    this.sock.ev.on('groups.update', updates => {
      for (const update of updates) {
        if (update.id) cacheManager.invalidateGroupMetadata(update.id);
      }
    });
  }

  private handleMessageRealTime(message: WAMessage): void {
    logger.debug(`🔔 handleMessageRealTime: id=${message.key.id}, fromMe=${message.key.fromMe}`);

    if (!message?.message || message.key.fromMe) {
      logger.debug('❌ Message skipped: no message or fromMe');
      return;
    }

    const messageId = message.key.id;
    if (!messageId) {
      logger.debug('❌ Message skipped: no messageId');
      return;
    }
    if (cacheManager.hasProcessedMessage(messageId)) {
      logger.debug(`❌ Message skipped: already processed ${messageId}`);
      return;
    }

    this.stats.messagesReceived++;
    logger.debug(`✅ Message received: ${messageId}`);

    setImmediate(() => {
      void (async () => {
        const startTime = Date.now();

        logger.debug(`🔄 Processing message ${messageId}...`);

        await this.messageProcessor.process(messageId, async () => {
          logger.debug(`📝 Creating MessageContext...`);
          try {
            // WAMessage and proto.IWebMessageInfo are the same shape in Baileys
            const ctx = new MessageContext(this.sock, message as proto.IWebMessageInfo);

            logger.debug(
              `📋 MessageContext created: command="${ctx.command}", text="${ctx.text.slice(0, 50)}", isGroup=${ctx.chat.isGroup}`,
            );

            if (ctx.chat.isGroup) {
              const isMuted = await serviceManager.moderationService.isMuted(
                ctx.chat.jid,
                ctx.sender.jid,
              );

              if (isMuted) {
                await ctx.loadBotPermissions();
                if (ctx.chat.isBotAdmin) {
                  try {
                    await this.sock.sendMessage(ctx.chat.jid, { delete: message.key });
                  } catch (_) {}
                }
                cacheManager.markMessageProcessed(messageId);
                return;
              }
            }

            if (ctx.chat.isGroup && !ctx.command) {
              const quizHandled = await quizAnswerHandler.handle(ctx);
              if (quizHandled) {
                cacheManager.markMessageProcessed(messageId);
                return;
              }

              const botJid = this.sock.user?.id ?? '';
              await handleMention(ctx, botJid);

              cacheManager.markMessageProcessed(messageId);
              return;
            }

            if (!ctx.command) {
              logger.info(
                `❌ No command detected, text: "${ctx.text}", prefix: "${config.prefix}"`,
              );
              cacheManager.markMessageProcessed(messageId);
              return;
            }

            logger.debug(`✅ Command detected: ${ctx.command}`);

            const rateLimit = this.antiSpam.checkRateLimit(ctx.sender.jid);
            if (!rateLimit.allowed) {
              this.stats.spamBlocked++;
              await ctx.reply(rateLimit.reason ?? '⚠️ Demasiados mensajes').catch(() => {});
              return;
            }

            if (ctx.chat.isGroup) {
              const floodCheck = rateLimitService.checkFlood(ctx.sender.jid);
              if (!floodCheck.allowed) {
                this.stats.spamBlocked++;
                await ctx
                  .reply(floodCheck.reason ?? '⚠️ Estás escribiendo muy rápido')
                  .catch(() => {});
                return;
              }

              const groupRateLimit = rateLimitService.checkGroupRateLimit(ctx.chat.jid);
              if (!groupRateLimit.allowed) {
                this.stats.spamBlocked++;
                await ctx
                  .reply(groupRateLimit.reason ?? '⚠️ El grupo está muy activo')
                  .catch(() => {});
                return;
              }
            }

            const fullCommand = ctx.args.length > 0 ? `${ctx.command} ${ctx.args[0]}` : null;

            logger.debug(`🔍 Looking for command: "${ctx.command}" or "${fullCommand}"`);

            const command =
              (fullCommand ? commandRegistry.get(fullCommand) : null) ??
              commandRegistry.get(ctx.command);

            logger.debug(`📦 Command found: ${command?.name || 'NULL'}`);

            if (!command) {
              logger.warn(`❌ Command not found in registry: ${ctx.command}`);
              cacheManager.markMessageProcessed(messageId);
              return;
            }

            logger.debug(`✅ Executing command: ${command.name}`);
            if (fullCommand && commandRegistry.get(fullCommand)) {
              ctx.args.shift();
            }
            if (command.permissions?.user || command.permissions?.bot) {
              if (ctx.chat.isGroup) {
                await Promise.all([ctx.loadSenderPermissions(), ctx.loadBotPermissions()]);
              } else {
                await ctx.loadSenderPermissions();
              }
            }

            await this.executeWithMiddlewares(ctx, async () => {
              logger.debug(`🚀 Running command: ${command.name}`);
              try {
                await command.execute(ctx);
                this.stats.commandsExecuted++;
                logger.debug(`✅ Command executed successfully: ${command.name}`);
              } catch (error) {
                this.stats.errorsCount++;
                logError('Command', new CommandExecutionError(ctx.command, error));
                await ctx.reply('Error al ejecutar el comando.').catch(() => {});
              }
            });

            cacheManager.markMessageProcessed(messageId);

            const processingTime = Date.now() - startTime;
            this.stats.totalProcessingTime += processingTime;
            if (processingTime > 500) logger.warn(`⚠️ ${ctx.command}: ${processingTime}ms`);
          } catch (error) {
            logError('handleMessageRealTime', error);
          }
        });

        if (Date.now() - this.stats.lastStatsLog > 300000) {
          this.logStats();
          this.stats.lastStatsLog = Date.now();
        }
      })();
    });
  }

  private async handleGroupUpdate(update: GroupParticipantsUpdate): Promise<void> {
    const { id: groupJid, participants, action } = update;
    if (!groupJid || !participants) return;

    try {
      cacheManager.invalidateGroupMetadata(groupJid);
      await serviceManager.groupService.getGroup(groupJid);

      if (action === 'add') {
        for (const participant of participants) {
          welcomeService
            .handleNewParticipant(this.sock, groupJid, participant)
            .catch(err => logError('handleNewParticipant', err));
        }
      }

      if (action === 'remove') {
        for (const participant of participants) {
          welcomeService
            .handleParticipantLeft(this.sock, groupJid, participant)
            .catch(err => logError('handleParticipantLeft', err));
        }
      }
    } catch (error) {
      logError('handleGroupUpdate', error);
    }
  }

  private async executeWithMiddlewares(
    ctx: MessageContext,
    handler: () => Promise<void>,
  ): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      const parallelBatch: IMiddleware[] = [];

      while (index < this.middlewares.length && this.middlewares[index].canRunParallel) {
        parallelBatch.push(this.middlewares[index].middleware);
        index++;
      }

      if (parallelBatch.length > 0) {
        await Promise.all(parallelBatch.map(mw => mw.execute(ctx, async () => {})));
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
      await Promise.resolve(this.sock?.ws?.close()).catch(() => {});
    } catch (_) {}
    await subBotManager.shutdown();
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
