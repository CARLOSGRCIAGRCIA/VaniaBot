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
import { RegistrationMiddleware } from '@/middlewares/RegistrationMiddleware.js';
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
import { handleAudioResponse } from '@/handlers/AudioResponseHandler.js';
import type { IMiddleware } from '@/types/index.js';
import { CommandCategory } from '@/types/index.js';
import { EventEmitter } from 'events';
import { welcomeService } from '@/services/system/WelcomeService.js';
import { subBotManager } from '@/services/subbot/SubBotManager.js';
import { rateLimitService } from '@/services/system/RateLimitService.js';
import { PermissionService } from '@/services/PermissionService.js';
import { antiDeleteService } from '@/services/system/AntiDeleteService.js';
import { antiCallService } from '@/services/system/AntiCallService.js';
import { env } from '@/config/env.js';
import { runtimeStateRepository } from '@/repositories/RuntimeStateRepository.js';
import { processedMessagesRepository } from '@/repositories/ProcessedMessagesRepository.js';

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
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
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
    this.cleanupTimer = setInterval(
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

  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

const COMMAND_TIMEOUT_MS = 30000;

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  commandName: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Command ${commandName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

interface QueuedMessage {
  id: string;
  handler: () => Promise<void>;
  parallel?: boolean;
}

class RealTimeMessageProcessor extends EventEmitter {
  private processing = new Set<string>();
  private sequentialQueue: QueuedMessage[] = [];
  private parallelQueue: QueuedMessage[] = [];
  private isProcessingSequential = false;
  private maxParallel = 3;
  private activeParallel = 0;

  async process(
    messageId: string,
    handler: () => Promise<void>,
    parallel = false,
  ): Promise<boolean> {
    if (this.processing.has(messageId)) return false;

    if (parallel) {
      this.parallelQueue.push({ id: messageId, handler, parallel: true });
    } else {
      this.sequentialQueue.push({ id: messageId, handler, parallel: false });
    }

    this.processParallelQueue().catch(err => this.emit('error', messageId, err));
    this.processSequentialQueue().catch(err => this.emit('error', messageId, err));
    return true;
  }

  private async processParallelQueue(): Promise<void> {
    if (this.activeParallel >= this.maxParallel || this.parallelQueue.length === 0) return;

    const item = this.parallelQueue.shift();
    if (!item) return;

    this.activeParallel++;
    this.processing.add(item.id);

    try {
      await item.handler();
      this.emit('processed', item.id);
    } catch (error) {
      this.emit('error', item.id, error);
    } finally {
      this.processing.delete(item.id);
      this.activeParallel--;
      void this.processParallelQueue();
    }
  }

  private async processSequentialQueue(): Promise<void> {
    if (this.isProcessingSequential || this.sequentialQueue.length === 0) return;
    this.isProcessingSequential = true;

    while (this.sequentialQueue.length > 0) {
      const item = this.sequentialQueue.shift();
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

    this.isProcessingSequential = false;
  }

  getStats() {
    return {
      processing: this.processing.size,
      sequentialQueued: this.sequentialQueue.length,
      parallelQueued: this.parallelQueue.length,
      activeParallel: this.activeParallel,
    };
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
  private maintenanceTimer: ReturnType<typeof setInterval> | null = null;
  private stats = {
    messagesReceived: 0,
    messagesProcessed: 0,
    commandsExecuted: 0,
    errorsCount: 0,
    spamBlocked: 0,
    totalProcessingTime: 0,
    lastStatsLog: Date.now(),
  };
  private commandMetrics = new Map<string, { count: number; totalTime: number; errors: number }>();
  private mainBotId: string | null = null;

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

    const { listaManager } = await import('@/services/game/ListaManager.js');
    await listaManager.initialize();

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
      { middleware: new RegistrationMiddleware(), priority: 1, canRunParallel: false },
      { middleware: new VaniaToggleMiddleware(), priority: 2, canRunParallel: false },
      { middleware: new MuteMiddleware(), priority: 3, canRunParallel: false },
      { middleware: new LoggerMiddleware(), priority: 3, canRunParallel: true },
      { middleware: new ValidationMiddleware(commandRegistry), priority: 4, canRunParallel: true },
      { middleware: new PermissionMiddleware(commandRegistry), priority: 5, canRunParallel: false },
      { middleware: new AntiSpamMiddleware(), priority: 6, canRunParallel: false },
      { middleware: new CooldownMiddleware(commandRegistry), priority: 7, canRunParallel: false },
    );

    this.middlewares.sort((a, b) => a.priority - b.priority);

    this.authManager.setOnSocketRecreate(async oldSock => {
      logger.info('🔄 Recreating socket...');

      if (oldSock) {
        try {
          await Promise.race([
            oldSock.ws.close(),
            new Promise(resolve => setTimeout(resolve, 1000)),
          ]);
        } catch {}
      }

      const newSock = await this.authManager.createSocket();
      this.sock = newSock;
      subBotManager.setMainSocket(newSock);
      this.registerSocketListeners();

      logger.info('✅ Socket recreated successfully');
      return newSock;
    });

    this.sock = await this.authManager.createSocket();
    subBotManager.setMainSocket(this.sock);
    await subBotManager.initialize();
    this.registerSocketListeners();
    this.antiSpam.startCleanup();
    this.startMaintenance();

    await this.warmup();

    this.isReady = true;
    logger.info('🚀 Bot ready for instant response');
  }

  private async warmup(): Promise<void> {
    logger.info('🔥 Warming up cache...');

    try {
      const cachedGroups = Array.from(cacheManager['groupMetadataCache'].keys()).slice(0, 10);

      for (const groupJid of cachedGroups) {
        try {
          const metadata = cacheManager.getGroupMetadata(groupJid);
          if (metadata) {
            cacheManager.setGroupMetadata(groupJid, metadata);
          }
        } catch {}
      }

      logger.debug(`🔥 Warmup complete: ${cachedGroups.length} groups cached`);
    } catch (error) {
      logger.debug('Warmup skipped:', error);
    }
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

        handleAudioResponse(this.sock, msg).catch(err => logError('handleAudioResponse', err));

        antiDeleteService.storeMessage(this.sock, msg).catch(err => {
          logger.debug('Error storing message for anti-delete:', err);
        });

        this.handleMessageRealTime(msg);
      }
    });

    this.sock.ev.on('connection.update', update => {
      if (update.connection === 'open' && this.sock.user?.id) {
        this.mainBotId = this.sock.user.id;
        runtimeStateRepository.setStartupTimestamp(this.mainBotId);
        logger.info(`[Client] Set startup timestamp for ${this.mainBotId}`);
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

    this.sock.ev.on('messages.delete', async update => {
      void this.handleMessageDeletion(update);
    });

    this.sock.ev.on('call', async calls => {
      void this.handleIncomingCalls(calls);
    });
  }

  private async handleIncomingCalls(calls: BaileysEventMap['call']): Promise<void> {
    if (!antiCallService.isEnabled()) return;

    for (const call of calls) {
      const callId = call.id;
      const caller = call.from;
      const isVideo = call.isVideo;
      const isGroup = call.isGroup;

      if (antiCallService.shouldBlock(caller)) continue;

      try {
        logger.info(
          `Rejecting call ${callId} from ${caller} (video: ${isVideo}, group: ${isGroup})`,
        );
        await this.sock.rejectCall(callId, caller);

        const callerName = caller.split('@')[0];
        const ownerMsg =
          `📵 *LLAMADA RECHAZADA*\n\n` +
          `👤 De: @${callerName}\n` +
          `🎥 Tipo: ${isVideo ? 'Video' : 'Voz'}\n` +
          `👥 Grupo: ${isGroup ? 'Sí' : 'No'}\n` +
          `🕐 Hora: ${new Date().toLocaleString()}`;

        try {
          await this.sock.sendMessage(env.OWNER_JID, {
            text: ownerMsg,
            mentions: [caller],
          });
        } catch {
          logger.debug('Could not send anti-call notification to owner');
        }
      } catch (err) {
        logger.debug('Error rejecting call:', err);
      }
    }
  }

  private async handleMessageDeletion(update: BaileysEventMap['messages.delete']): Promise<void> {
    try {
      const botJid = this.sock.user?.id || '';
      const botNumber = botJid.split(':')[0];

      const keys = 'keys' in update ? update.keys : [];

      for (const key of keys) {
        const messageId = key.id;
        if (!messageId) continue;

        const deletedBy = key.participant || key.remoteJid || '';
        if (deletedBy.includes(botNumber)) continue;

        const original = antiDeleteService.getMessage(messageId);
        if (!original) continue;

        const notification = antiDeleteService.formatDeletedMessageNotification(
          deletedBy,
          original,
          this.sock,
        );

        try {
          await this.sock.sendMessage(env.OWNER_JID, {
            text: notification,
            mentions: [deletedBy, original.sender],
          });

          if (original.mediaBuffer && original.mediaType) {
            const mediaOptions: Record<string, unknown> = {
              caption: `📎 *Medio eliminado:* ${original.mediaType}\nDe: @${original.sender.split('@')[0]}`,
              mentions: [original.sender],
            };

            if (original.mediaType === 'image') {
              await this.sock.sendMessage(env.OWNER_JID, {
                image: original.mediaBuffer,
                ...mediaOptions,
              });
            } else if (original.mediaType === 'video') {
              await this.sock.sendMessage(env.OWNER_JID, {
                video: original.mediaBuffer,
                ...mediaOptions,
              });
            } else if (original.mediaType === 'sticker') {
              await this.sock.sendMessage(env.OWNER_JID, {
                sticker: original.mediaBuffer,
                ...mediaOptions,
              });
            } else if (original.mediaType === 'audio') {
              await this.sock.sendMessage(env.OWNER_JID, {
                audio: original.mediaBuffer,
                mimetype: 'audio/mpeg',
                ptt: false,
                ...mediaOptions,
              });
            }
          }
        } catch (err) {
          logger.debug('Error sending anti-delete notification:', err);
        }

        antiDeleteService.deleteMessage(messageId);
      }
    } catch (err) {
      logError('handleMessageDeletion', err);
    }
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

    if (this.mainBotId) {
      const lastStartup = runtimeStateRepository.getLastStartupAt(this.mainBotId);
      if (lastStartup) {
        const rawTimestamp = message.messageTimestamp;
        const msgTimestamp =
          rawTimestamp !== undefined && rawTimestamp !== null ? Number(rawTimestamp) * 1000 : 0;
        const startupTime = new Date(lastStartup).getTime();
        if (msgTimestamp > 0 && msgTimestamp < startupTime) {
          logger.debug(`[MainBot] Skipping pre-startup message ${messageId}`);
          processedMessagesRepository.markProcessed(messageId, this.mainBotId);
          cacheManager.markMessageProcessed(messageId);
          return;
        }
      }
    }

    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const isCommand =
      text.startsWith(config.prefix) || text.startsWith('.') || text.startsWith('!');
    const commandName = text.slice(1).split(' ')[0].toLowerCase();
    const fullCommandName = text.startsWith(config.prefix)
      ? text.slice(1).toLowerCase()
      : text.startsWith('.') || text.startsWith('!')
        ? text.slice(1).toLowerCase()
        : null;

    let isParallelizable = false;
    if (isCommand && fullCommandName) {
      const cmd = commandRegistry.get(fullCommandName) || commandRegistry.get(commandName);
      isParallelizable = cmd?.parallelizable || false;
    }

    this.stats.messagesReceived++;
    logger.debug(`✅ Message received: ${messageId}`);

    queueMicrotask(() => {
      void (async () => {
        const startTime = Date.now();

        logger.debug(`🔄 Processing message ${messageId}...`);

        await this.messageProcessor.process(
          messageId,
          async () => {
            logger.debug(`📝 Creating MessageContext...`);
            try {
              // WAMessage and proto.IWebMessageInfo are the same shape in Baileys
              const ctx = new MessageContext(this.sock, message as proto.IWebMessageInfo, 'main');

              logger.debug(
                `📋 MessageContext created: command="${ctx.command}", text="${ctx.text.slice(0, 50)}", isGroup=${ctx.chat.isGroup}`,
              );

              if (ctx.chat.isGroup) {
                const isVaniaToggleCommand = ['vaniaon', 'vaniaoff', 'vaniastatus'].includes(
                  ctx.command,
                );

                if (isVaniaToggleCommand && ctx.args[0]) {
                  const slotNum = parseInt(ctx.args[0]);
                  if (!isNaN(slotNum) && slotNum > 0) {
                    logger.debug(
                      `📤 Main skipping slot-specific toggle command: ${ctx.command} ${slotNum}`,
                    );
                    cacheManager.markMessageProcessed(messageId);
                    return;
                  }
                }

                if (!isVaniaToggleCommand) {
                  try {
                    const isEnabled = await serviceManager.vaniaToggleService.isEnabled(
                      ctx.chat.jid,
                      'main',
                    );
                    if (!isEnabled) {
                      cacheManager.markMessageProcessed(messageId);
                      return;
                    }
                  } catch {}
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
                const cmdStartTime = Date.now();

                if (command.enabled === false) {
                  const isNsfwCommand = command.category === CommandCategory.ANIME;
                  if (isNsfwCommand) {
                    const { NsfwToggleCommand } =
                      await import('../commands/owner/NsfwToggleCommand.js');
                    if (!NsfwToggleCommand.isEnabled()) {
                      logger.debug(`⚠️ Command ${command.name} is NSFW and disabled`);
                      await ctx
                        .reply(
                          '🔞 Los comandos NSFW están deshabilitados.\nUsa !nsfw on para habilitar.',
                        )
                        .catch(() => {});
                      return;
                    }
                  } else {
                    logger.debug(`⚠️ Command ${command.name} is disabled`);
                    await ctx.reply('❌ Este comando está deshabilitado.').catch(() => {});
                    return;
                  }
                }

                try {
                  await withTimeout(command.execute(ctx), COMMAND_TIMEOUT_MS, command.name);
                  this.stats.commandsExecuted++;
                  this.trackCommandMetric(command.name, Date.now() - cmdStartTime, false);
                  logger.debug(`✅ Command executed successfully: ${command.name}`);
                } catch (error) {
                  this.stats.errorsCount++;
                  this.trackCommandMetric(command.name, Date.now() - cmdStartTime, true);
                  if (error instanceof Error && error.message.includes('timed out')) {
                    logger.error(`⏱️ Command ${command.name} timed out`);
                    await ctx
                      .reply('⏱️ El comando tardó demasiado. Intenta de nuevo.')
                      .catch(() => {});
                  } else {
                    logError('Command', new CommandExecutionError(ctx.command, error));
                    await ctx.reply('Error al ejecutar el comando.').catch(() => {});
                  }
                }
              });

              cacheManager.markMessageProcessed(messageId);

              const processingTime = Date.now() - startTime;
              this.stats.totalProcessingTime += processingTime;
              if (processingTime > 500) logger.warn(`⚠️ ${ctx.command}: ${processingTime}ms`);
            } catch (error) {
              logError('handleMessageRealTime', error);
            }
          },
          isParallelizable,
        );

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
            .handleParticipantLeft(this.sock, groupJid, participant, 'main')
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

  private trackCommandMetric(name: string, time: number, error: boolean): void {
    const existing = this.commandMetrics.get(name) || { count: 0, totalTime: 0, errors: 0 };
    this.commandMetrics.set(name, {
      count: existing.count + 1,
      totalTime: existing.totalTime + time,
      errors: existing.errors + (error ? 1 : 0),
    });
  }

  getCommandMetrics(): Array<{ command: string; count: number; avgTime: number; errors: number }> {
    return Array.from(this.commandMetrics.entries()).map(([command, data]) => ({
      command,
      count: data.count,
      avgTime: Math.round(data.totalTime / data.count),
      errors: data.errors,
    }));
  }

  private startMaintenance(): void {
    this.maintenanceTimer = setInterval(
      () => {
        const queueStats = this.messageProcessor.getStats();
        const totalQueued = queueStats.sequentialQueued + queueStats.parallelQueued;
        if (totalQueued > 20)
          logger.warn(
            `⚠️ Cola: ${totalQueued} mensajes pendientes (seq: ${queueStats.sequentialQueued}, par: ${queueStats.parallelQueued})`,
          );
      },
      5 * 60 * 1000,
    );
  }

  private async notifyAdminsMute(ctx: MessageContext): Promise<void> {
    try {
      const admins = await PermissionService.getGroupAdmins(ctx.sock, ctx.chat.jid);
      const botJid = ctx.sock.user?.id;
      const adminJids = admins.filter(admin => admin !== botJid);

      if (adminJids.length === 0) {
        logger.debug(`[MUTE] No hay admins para notificar en ${ctx.chat.jid}`);
        return;
      }

      const muteInfo = await serviceManager.moderationService.getMuteInfo(
        ctx.chat.jid,
        ctx.sender.jid,
      );
      const timeRemaining = await serviceManager.moderationService.getMuteTimeRemaining(
        ctx.chat.jid,
        ctx.sender.jid,
      );
      const timeText = this.formatTimeRemaining(timeRemaining);

      for (const adminJid of adminJids) {
        try {
          await ctx.sock.sendMessage(adminJid, {
            text:
              `🔇 *Aviso de Mute*\n\n` +
              `El usuario *${ctx.sender.pushName || 'Desconocido'}* está muteado pero intentó enviar un mensaje.\n\n` +
              `📝 Razón: ${muteInfo?.reason || 'No especificada'}\n` +
              `⏱️ Tiempo restante: ${timeText}\n` +
              `💬 Mensaje: ${ctx.text.slice(0, 100)}${ctx.text.length > 100 ? '...' : ''}\n\n` +
              `⚠️ El bot necesita ser admin para eliminar automáticamente los mensajes muteados.`,
          });
        } catch (error) {
          logger.debug(`[MUTE] Error notificando admin ${adminJid}:`, error);
        }
      }
    } catch (error) {
      logError('[MUTE] Error notifyAdmins', error);
    }
  }

  private formatTimeRemaining(ms: number): string {
    if (ms <= 0) return 'Expira inmediatamente';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} día${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hora${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `${minutes} minuto${minutes > 1 ? 's' : ''}`;
    return `${seconds} segundo${seconds > 1 ? 's' : ''}`;
  }

  private logStats(): void {
    if (this.stats.messagesReceived === 0) return;
    const avgTime =
      this.stats.messagesProcessed > 0
        ? this.stats.totalProcessingTime / this.stats.messagesProcessed
        : 0;
    const queueStats = this.messageProcessor.getStats();
    const cacheStats = cacheManager.getStats();
    const totalQueued = queueStats.sequentialQueued + queueStats.parallelQueued;
    logger.info(
      `${this.stats.messagesReceived} recv | ` +
        `${this.stats.commandsExecuted} cmds | ` +
        `${this.stats.spamBlocked}⛔ | ` +
        `${avgTime.toFixed(0)}ms avg | ` +
        `queue ${totalQueued} | ` +
        `cache ${cacheStats.hitRate}`,
    );
  }

  async shutdown(): Promise<void> {
    this.isReady = false;

    try {
      await this.authManager.shutdown();
    } catch {}

    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
      this.maintenanceTimer = null;
    }

    this.antiSpam.stop();

    const antiSpamMw = this.middlewares.find(m => m.middleware instanceof AntiSpamMiddleware);
    if (antiSpamMw) {
      (antiSpamMw.middleware as AntiSpamMiddleware).stop();
    }

    rateLimitService.stop();
    cacheManager.stop();

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
      commandMetrics: this.getCommandMetrics(),
    };
  }
}
