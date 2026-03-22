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
import { VaniaToggleMiddleware } from '@/middlewares/VaniaToggleMiddleware.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { logger, logError } from '@/utils/logger.js';
import { CommandExecutionError } from '@/utils/errors.js';
import { cacheManager } from '@/core/CacheManager.js';
import { handleReaccion } from '@/handlers/ReaccionHandler.js';
import { quizAnswerHandler } from '@/handlers/QuizAnswerHandler.js';
import { handleMention } from '@/handlers/AiMentionHandler.js';
import type { IMiddleware } from '@/types/index.js';
import { welcomeService } from '@/services/system/WelcomeService.js';
import { subBotManager } from '@/services/subbot/SubBotManager.js';
import { rateLimitService } from '@/services/system/RateLimitService.js';
import { AntiSpamService } from '@/services/system/AntiSpamService.js';
import { MessageProcessorService } from '@/services/system/MessageProcessorService.js';

type GroupParticipantsUpdate = BaileysEventMap['group-participants.update'];

declare global {
  var client: WhatsAppClient | undefined;
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
  private messageProcessor = new MessageProcessorService();
  private antiSpam = new AntiSpamService();
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
    this.messageProcessor.on('error', (_id: string, error: unknown) => {
      this.stats.errorsCount++;
      logError('Message processor error', error);
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
      { middleware: new VaniaToggleMiddleware(), priority: 2, canRunParallel: false },
      { middleware: new MuteMiddleware(), priority: 3, canRunParallel: false },
      { middleware: new LoggerMiddleware(), priority: 3, canRunParallel: true },
      { middleware: new ValidationMiddleware(commandRegistry), priority: 4, canRunParallel: true },
      { middleware: new PermissionMiddleware(commandRegistry), priority: 5, canRunParallel: false },
      { middleware: new AntiSpamMiddleware(), priority: 6, canRunParallel: false },
      { middleware: new CooldownMiddleware(commandRegistry), priority: 7, canRunParallel: false },
    );

    this.middlewares.sort((a, b) => a.priority - b.priority);

    this.sock = await this.authManager.createSocket();
    subBotManager.setMainSocket(this.sock);
    serviceManager.persistenceService.setSocket(this.sock);
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
      void this.handleGroupUpdate(update).catch(err => logError('Client.handleGroupUpdate', err));
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
            const ctx = new MessageContext(this.sock, message as proto.IWebMessageInfo);

            logger.debug(
              `📋 MessageContext created: command="${ctx.command}", text="${ctx.text.slice(0, 50)}", isGroup=${ctx.chat.isGroup}`,
            );

            if (await this.handleMuteCheck(ctx, message)) {
              return;
            }

            if (await this.handleGroupAutoResponses(ctx)) {
              return;
            }

            if (!ctx.command) {
              logger.info(
                `❌ No command detected, text: "${ctx.text}", prefix: "${config.prefix}"`,
              );
              cacheManager.markMessageProcessed(messageId);
              return;
            }

            if (await this.checkCommandRateLimits(ctx)) {
              return;
            }

            await this.executeCommand(ctx, messageId);

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

  private async handleMuteCheck(ctx: MessageContext, message: WAMessage): Promise<boolean> {
    if (!ctx.chat.isGroup) return false;

    logger.debug(`[MUTE] Verificando mute para ${ctx.sender.jid} en ${ctx.chat.jid}`);

    const isMuted = await serviceManager.moderationService.isMuted(ctx.chat.jid, ctx.sender.jid);

    logger.debug(`[MUTE] Resultado: ${isMuted}`);

    if (!isMuted) return false;

    const botJid = this.sock.user?.id ?? '';
    if (botJid) {
      cacheManager.invalidateGroupMetadata(ctx.chat.jid);
    }
    await ctx.loadBotPermissions();

    if (ctx.chat.isBotAdmin) {
      try {
        await this.sock.sendMessage(ctx.chat.jid, { delete: message.key });
        logger.info(`[MUTE] Mensaje eliminado: ${message.key.id}`);
      } catch (error) {
        logError('[MUTE] Error al eliminar mensaje', error);
      }
    }

    if (!message.key.id) return false;
    cacheManager.markMessageProcessed(message.key.id);
    return true;
  }

  private async handleGroupAutoResponses(ctx: MessageContext): Promise<boolean> {
    if (!ctx.chat.isGroup || ctx.command) return false;

    const isEnabled = await serviceManager.vaniaToggleService.isEnabled(ctx.chat.jid);
    if (!isEnabled) {
      const wasMentioned = this.checkIfBotWasMentioned(ctx);
      if (wasMentioned) {
        await ctx
          .reply(
            '🤫 *VaniaBot está descansando en este grupo*\nUsa comandos en otro grupo o espera a que lo activen',
          )
          .catch(() => {});
      }
      if (ctx.message.key.id) cacheManager.markMessageProcessed(ctx.message.key.id);
      return true;
    }

    const quizHandled = await quizAnswerHandler.handle(ctx);
    if (quizHandled) {
      if (ctx.message.key.id) cacheManager.markMessageProcessed(ctx.message.key.id);
      return true;
    }

    const botJid = this.sock.user?.id ?? '';
    await handleMention(ctx, botJid);

    if (ctx.message.key.id) cacheManager.markMessageProcessed(ctx.message.key.id);
    return true;
  }

  private checkIfBotWasMentioned(ctx: MessageContext): boolean {
    const message = ctx.message.message;
    const mentionedJids: string[] = message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
    const botJid = this.sock.user?.id ?? '';
    const botNumber = botJid.split('@')[0].split(':')[0];

    return mentionedJids.some((jid: string) => {
      const jidClean = jid.split('@')[0].split(':')[0];
      return jidClean === botNumber;
    });
  }

  private async checkCommandRateLimits(ctx: MessageContext): Promise<boolean> {
    const rateLimit = this.antiSpam.check(ctx.sender.jid);
    if (!rateLimit.allowed) {
      this.stats.spamBlocked++;
      await ctx.reply(rateLimit.reason ?? '⚠️ Demasiados mensajes').catch(() => {});
      return true;
    }

    if (ctx.chat.isGroup) {
      const floodCheck = rateLimitService.checkFlood(ctx.sender.jid);
      if (!floodCheck.allowed) {
        this.stats.spamBlocked++;
        await ctx.reply(floodCheck.reason ?? '⚠️ Estás escribiendo muy rápido').catch(() => {});
        return true;
      }

      const groupRateLimit = rateLimitService.checkGroupRateLimit(ctx.chat.jid);
      if (!groupRateLimit.allowed) {
        this.stats.spamBlocked++;
        await ctx.reply(groupRateLimit.reason ?? '⚠️ El grupo está muy activo').catch(() => {});
        return true;
      }
    }

    return false;
  }

  private async executeCommand(ctx: MessageContext, messageId: string): Promise<void> {
    const fullCommand = ctx.args.length > 0 ? `${ctx.command} ${ctx.args[0]}` : null;

    logger.debug(`🔍 Looking for command: "${ctx.command}" or "${fullCommand}"`);

    const command =
      (fullCommand ? commandRegistry.get(fullCommand) : null) ?? commandRegistry.get(ctx.command);

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
  }

  private async handleGroupUpdate(update: GroupParticipantsUpdate): Promise<void> {
    const { id: groupJid, participants, action } = update;
    if (!groupJid || !participants) return;

    try {
      cacheManager.invalidateGroupMetadata(groupJid);
      await serviceManager.groupService.getGroup(groupJid);

      const isEnabled = await serviceManager.vaniaToggleService.isEnabled(groupJid);
      if (!isEnabled) return;

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
        try {
          const queueStats = this.messageProcessor.getStats();
          if (queueStats.queued > 20)
            logger.warn(`⚠️ Cola: ${queueStats.queued} mensajes pendientes`);
        } catch (error) {
          logger.error('[Client] Maintenance check failed:', error);
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
    } catch (error) {
      logger.debug('[Client] WebSocket close error (non-fatal):', error);
    }
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
