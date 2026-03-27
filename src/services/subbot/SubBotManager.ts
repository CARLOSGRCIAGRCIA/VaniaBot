/**
 * SubBotManager.ts
 *
 * Main manager for VaniaBot's subbot system.
 * Handles the lifecycle of multiple subbot instances,
 * including registration, connection, message handling, and events.
 *
 * @author **Carlos G** ⭐
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { randomBytes } from 'crypto';
import { rmSync, existsSync } from 'fs';
import { EventEmitter } from 'events';
import type { WAMessage, proto, WASocket } from '@whiskeysockets/baileys';
import type { SubBotConfig, SubBotStatus } from '@/types/subbot.js';
import { SubBotInstance } from './SubBotInstance.js';
import { subBotDatabase } from './SubBotDatabase.js';
import { logger, logError } from '@/utils/logger.js';
import { commandRegistry } from '@/core/CommandRegistry.js';
import { MessageContext } from '@/core/MessageContext.js';
import { cacheManager } from '@/core/CacheManager.js';
import { config } from '@/config/index.js';
import { ValidationMiddleware } from '@/middlewares/ValidationMiddleware.js';
import { PermissionMiddleware } from '@/middlewares/PermissionMiddleware.js';
import { CooldownMiddleware } from '@/middlewares/CooldownMiddleware.js';
import { AntiSpamMiddleware } from '@/middlewares/AntiSpamMiddleware.js';
import { AutoRegisterMiddleware } from '@/middlewares/AutoRegisterMiddleware.js';
import { MuteMiddleware } from '@/middlewares/MuteMiddleware.js';
import { LoggerMiddleware } from '@/middlewares/LoggerMiddleware.js';
import { VaniaToggleMiddleware } from '@/middlewares/VaniaToggleMiddleware.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { handleReaccion } from '@/handlers/ReaccionHandler.js';
import { quizAnswerHandler } from '@/handlers/QuizAnswerHandler.js';
import { handleMention } from '@/handlers/AiMentionHandler.js';
import { welcomeService } from '@/services/system/WelcomeService.js';
import { PermissionService } from '@/services/PermissionService.js';
import { CommandExecutionError } from '@/utils/errors.js';
import type { IMiddleware } from '@/types/index.js';
import type { BaileysEventMap } from '@whiskeysockets/baileys';
import { AntiSpamService } from '@/services/system/AntiSpamService.js';

/**
 * Maximum number of subbots allowed in the system
 */
const MAX_SUBBOTS = 50;
/**
 * Base path where subbot sessions are stored
 */
const SESSION_BASE_PATH = './data/subbot-sessions';

interface MiddlewareConfig {
  middleware: IMiddleware;
  priority: number;
  canRunParallel: boolean;
}

type GroupParticipantsUpdate = BaileysEventMap['group-participants.update'];

/**
 * Gestor principal del sistema de subbots.
 * Implementa el patrón Singleton para gestionar múltiples instancias de subbots.
 * Maneja el registro, conexión, mensajes, middlewares y eventos de grupos.
 *
 * @example
 * ```typescript
 * const manager = SubBotManager.getInstance();
 * await manager.initialize();
 * const subBot = await manager.registerSubBot(ownerJid, name, phoneNumber);
 * ```
 *
 * @see {@link SubBotInstance} para la gestión de conexiones individuales
 * @see {@link subBotDatabase} para el almacenamiento persistente
 */
export class SubBotManager extends EventEmitter {
  private static instance: SubBotManager;
  private instances = new Map<string, SubBotInstance>();
  private middlewaresPerInstance = new Map<string, MiddlewareConfig[]>();
  private antiSpamPerInstance = new Map<string, AntiSpamService>();
  private processedMessages = new Set<string>();
  private mainSock?: WASocket;

  /**
   * Constructor privado para implementar el patrón Singleton.
   * Usa EventEmitter para manejar eventos de subbots.
   */
  private constructor() {
    super();
  }

  /**
   * Obtiene la instancia única del gestor de subbots (patrón Singleton).
   *
   * @returns La instancia de SubBotManager
   * @throws No lanza errores
   */
  static getInstance(): SubBotManager {
    if (!SubBotManager.instance) {
      SubBotManager.instance = new SubBotManager();
    }
    return SubBotManager.instance;
  }

  /**
   * Establece el socket principal del bot para enviar notificaciones.
   *
   * @param sock - Socket de Baileys del bot principal
   * @returns void
   */
  setMainSocket(sock: WASocket): void {
    this.mainSock = sock;
    logger.info('🌸 SubBotManager: socket principal registrado');
  }

  /**
   * Inicializa el gestor de subbots cargando subbots activas desde la base de datos.
   *
   * @returns Promise<void> - Promesa que se resuelve cuando inicia correctamente
   * @throws Error si falla la conexión con la base de datos
   */
  async initialize(): Promise<void> {
    logger.info('🌸 Iniciando SubBotManager (VaniaBot)...');
    const active = subBotDatabase.getActive();
    logger.info(`📦 ${active.length} subbots activas encontradas`);
    for (const subConfig of active) {
      await this.launchInstance(subConfig);
    }

    this.startHealthCheck();

    logger.info('✅ SubBotManager inicializada correctamente');
  }

  private healthCheckInterval?: NodeJS.Timeout;
  private readonly HEALTH_CHECK_INTERVAL = 5 * 60 * 1000;

  private startHealthCheck(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(async () => {
      logger.debug('🔍 SubBotManager: ejecutando health check...');

      const activeSubBots = subBotDatabase.getActive();

      for (const subConfig of activeSubBots) {
        const instance = this.instances.get(subConfig.id);

        if (!instance) {
          logger.warn(`⚠️ SubBot[${subConfig.id}] sin instancia, reactivando...`);
          try {
            await this.launchInstance(subConfig);
          } catch (error) {
            logError(`SubBotManager.healthCheck: reactivate ${subConfig.id}`, error);
          }
          continue;
        }

        const isReallyConnected = instance.isConnected();
        if (!isReallyConnected) {
          logger.warn(`⚠️ SubBot[${subConfig.id}] detectada sin conexión real, reconectando...`);
          try {
            await instance.stop();
            this.instances.delete(subConfig.id);
            await this.launchInstance(subConfig);
          } catch (error) {
            logError(`SubBotManager.healthCheck: reconnect ${subConfig.id}`, error);
          }
        }
      }
    }, this.HEALTH_CHECK_INTERVAL);

    logger.info(
      `✅ Health check de subbots iniciado (cada ${this.HEALTH_CHECK_INTERVAL / 60000} minutos)`,
    );
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  async registerSubBot(
    ownerJid: string,
    ownerName: string,
    phoneNumber: string,
  ): Promise<SubBotConfig> {
    if (subBotDatabase.existsByOwner(ownerJid)) {
      throw new Error('Ya tienes una subbot registrada. Usa .delbot para eliminarla primero.');
    }
    const total = subBotDatabase.getAll().length;
    if (total >= MAX_SUBBOTS) {
      throw new Error('Se alcanzó el límite máximo de subbots.');
    }

    const id = randomBytes(8).toString('hex');
    const sessionPath = `${SESSION_BASE_PATH}/${id}`;

    const subConfig: SubBotConfig = {
      id,
      ownerJid,
      ownerName,
      phoneNumber: phoneNumber.replace(/\D/g, ''),
      sessionPath,
      prefix: config.prefix,
      name: `VaniaBot-${ownerName.slice(0, 10)}`,
      active: true,
      createdAt: Date.now(),
      status: 'pending',
    };

    subBotDatabase.set(subConfig);
    logger.info(`🌸 SubBot registrada: id=${id} owner=${ownerJid} phone=${subConfig.phoneNumber}`);
    await this.launchInstance(subConfig);
    return subConfig;
  }

  private buildMiddlewares(subBotId: string): MiddlewareConfig[] {
    logger.debug(`🔧 SubBot[${subBotId}] construyendo pipeline de middlewares...`);
    const mws: MiddlewareConfig[] = [
      { middleware: new AutoRegisterMiddleware(), priority: 1, canRunParallel: false },
      { middleware: new VaniaToggleMiddleware(), priority: 2, canRunParallel: false },
      { middleware: new MuteMiddleware(), priority: 3, canRunParallel: false },
      { middleware: new LoggerMiddleware(), priority: 4, canRunParallel: true },
      { middleware: new ValidationMiddleware(commandRegistry), priority: 5, canRunParallel: true },
      { middleware: new PermissionMiddleware(commandRegistry), priority: 6, canRunParallel: false },
      { middleware: new AntiSpamMiddleware(), priority: 7, canRunParallel: false },
      { middleware: new CooldownMiddleware(commandRegistry), priority: 8, canRunParallel: false },
    ];
    mws.sort((a, b) => a.priority - b.priority);
    logger.debug(`✅ SubBot[${subBotId}] pipeline listo (${mws.length} middlewares)`);
    return mws;
  }

  private async launchInstance(subConfig: SubBotConfig): Promise<void> {
    if (this.instances.has(subConfig.id)) {
      logger.debug(`🔄 SubBot[${subConfig.id}] deteniendo instancia anterior...`);
      await this.instances.get(subConfig.id)?.stop();
      this.instances.delete(subConfig.id);
      this.middlewaresPerInstance.delete(subConfig.id);
      this.antiSpamPerInstance.delete(subConfig.id);
    }

    const middlewares = this.buildMiddlewares(subConfig.id);
    this.middlewaresPerInstance.set(subConfig.id, middlewares);

    const antiSpam = new AntiSpamService();
    antiSpam.startCleanup();
    this.antiSpamPerInstance.set(subConfig.id, antiSpam);

    const instance = new SubBotInstance(subConfig);

    let pairingCodeTimeout: NodeJS.Timeout | undefined;

    instance.on('pairingCode', async (code: string) => {
      if (pairingCodeTimeout) {
        clearTimeout(pairingCodeTimeout);
      }

      if (!this.mainSock) return;
      logger.info(`🔑 SubBot[${subConfig.id}] enviando código a ${subConfig.ownerJid}`);
      try {
        await this.mainSock.sendMessage(subConfig.ownerJid, {
          text:
            `╭━━━ 🌸 *VaniaBot* ━━━╮\n` +
            `   *Vincular SubBot*\n` +
            `\n` +
            `💝 Tu SubBot está lista\n` +
            `   para conectarse.\n` +
            `\n` +
            `*Código de vinculación*\n` +
            `╭───────────────╮\n` +
            `│    *${code}*    │\n` +
            `╰───────────────╯\n` +
            `\n` +
            `✨ *Cómo vincularla*\n` +
            `1️⃣ Abre *WhatsApp* en\n` +
            `   el teléfono de la SubBot\n` +
            `2️⃣ Ve a *Dispositivos vinculados*\n` +
            `3️⃣ Toca *Vincular dispositivo*\n` +
            `4️⃣ Ingresa el código de arriba\n` +
            `\n` +
            `⏳ El código expira\n` +
            `   en *3 minutos*\n` +
            `\n` +
            `Número:\n` +
            `   *+${subConfig.phoneNumber}*\n` +
            `\n` +
            `   Estaré esperando 💗\n` +
            `╰━━━━━━━━━━━━━━━━━━━━╯`,
        });

        pairingCodeTimeout = setTimeout(async () => {
          if (subConfig.status !== 'connected' && this.mainSock) {
            logger.warn(`⏰ SubBot[${subConfig.id}] código no utilizado, reenviando...`);
            try {
              await this.mainSock.sendMessage(subConfig.ownerJid, {
                text:
                  `╭━━━ 🌸 *VaniaBot* ━━━╮\n` +
                  `   *Recordatorio SubBot*\n` +
                  `\n` +
                  `⏰ El código anterior\n` +
                  `   quizás expiró.\n` +
                  `\n` +
                  `✨ Usa *.reconbot*\n` +
                  `   para generar uno nuevo.\n` +
                  `\n` +
                  `   Estoy aquí 💗\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━╯`,
              });
            } catch {}
          }
        }, 180000);
      } catch (e) {
        logError(`SubBot[${subConfig.id}].sendPairingCode`, e);
      }
    });

    instance.on('ready', async () => {
      if (pairingCodeTimeout) {
        clearTimeout(pairingCodeTimeout);
        pairingCodeTimeout = undefined;
      }
      if (!this.mainSock) return;
      logger.info(`🎉 SubBot[${subConfig.id}] lista, notificando owner`);

      if (!subConfig.ownerJid) {
        logger.warn(`SubBot[${subConfig.id}] sin ownerJid, saltando notificación`);
        return;
      }

      // Precargar grupos para reducir cold start
      try {
        const groups = await Promise.race([
          instance.sock?.groupFetchAllParticipating(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timed Out')), 10000),
          ),
        ]);
        if (groups) {
          const groupIds = Object.keys(groups);
          logger.debug(`🔥 SubBot[${subConfig.id}] precargando ${groupIds.length} grupos...`);
          await Promise.allSettled(groupIds.map(gid => serviceManager.groupService.getGroup(gid)));
          logger.debug(`✅ SubBot[${subConfig.id}] grupos precargados`);
        }
      } catch (e) {
        logger.warn(
          `⚠️ SubBot[${subConfig.id}] preloadGroups: ${e instanceof Error ? e.message : e}`,
        );
      }

      try {
        await this.mainSock.sendMessage(subConfig.ownerJid, {
          text:
            `╭━━━ 🌸 *VaniaBot* ━━━╮\n` +
            `   🤖 *SubBot activada*\n` +
            `\n` +
            `💝 ¡Tu SubBot ya está\n` +
            `   lista para usarse!\n` +
            `\n` +
            `🏷️ Nombre:\n` +
            `   *${subConfig.name}*\n` +
            `\n` +
            `Número:\n` +
            `   *+${subConfig.phoneNumber}*\n` +
            `\n` +
            `Prefijo:\n` +
            `   *${config.prefix}*\n` +
            `\n` +
            `ID:\n` +
            `   \`${subConfig.id}\`\n` +
            `\n` +
            `✨ Tu SubBot tiene\n` +
            `   todos mis comandos\n` +
            `   disponibles.\n` +
            `\n` +
            `🦋 Puedes usarla igual\n` +
            `   que a VaniaBot.\n` +
            `\n` +
            `   ¡Disfrútala! 💗\n` +
            `╰━━━━━━━━━━━━━━━━━━━━╯`,
        });
      } catch (e) {
        logError(`SubBot[${subConfig.id}].sendReady`, e);
      }
    });

    instance.on('sessionInvalid', async () => {
      if (!this.mainSock) return;
      logger.warn(`⚠️ SubBot[${subConfig.id}] sesión inválida, notificando owner`);
      try {
        await this.mainSock.sendMessage(subConfig.ownerJid, {
          text:
            `╭━━━ 🌸 *VaniaBot* ━━━╮\n` +
            `   *SubBot desconectada*\n` +
            `\n` +
            `Parece que tu SubBot\n` +
            `   se ha desconectado.\n` +
            `\n` +
            `Probablemente la sesión\n` +
            `   se cerró desde el\n` +
            `   teléfono.\n` +
            `\n` +
            `Para volver a conectarla\n` +
            `   usa:\n` +
            `\n` +
            `   *.reconbot*\n` +
            `\n` +
            `Cuando quieras,\n` +
            `   puedo ayudarte\n` +
            `   a vincularla otra vez.\n` +
            `\n` +
            `   Estoy aquí 💗\n` +
            `╰━━━━━━━━━━━━━━━━━━━━╯`,
        });
      } catch {
        // Ignore notification errors during reconnection
      }
    });

    instance.on('message', (msg: WAMessage, sock: WASocket) => {
      void this.handleSubBotMessage(msg, sock, subConfig).catch(err =>
        logError(`SubBotManager[${subConfig.id}].handleSubBotMessage`, err),
      );
    });

    instance.on('groupUpdate', (update: GroupParticipantsUpdate) => {
      if (instance.sock) {
        void this.handleGroupUpdate(update, instance.sock).catch(err =>
          logError(`SubBotManager[${subConfig.id}].handleGroupUpdate`, err),
        );
      }
    });

    this.instances.set(subConfig.id, instance);
    await instance.start();
    logger.info(`✅ SubBot[${subConfig.id}] instancia lanzada`);
  }

  private async handleSubBotMessage(
    msg: WAMessage,
    sock: WASocket,
    subConfig: SubBotConfig,
  ): Promise<void> {
    if (!msg?.message || msg.key.fromMe) return;

    const messageId = msg.key.id;
    if (!messageId) return;

    if (this.processedMessages.has(messageId)) return;
    this.processedMessages.add(messageId);
    setTimeout(() => this.processedMessages.delete(messageId), 60000);

    const startTime = Date.now();

    try {
      if (msg.message?.reactionMessage) {
        await handleReaccion(sock, msg).catch(err =>
          logError(`SubBot[${subConfig.id}].handleReaccion`, err),
        );
        return;
      }

      const ctx = new MessageContext(sock, msg as proto.IWebMessageInfo);

      if (ctx.chat.isGroup) {
        logger.debug(`[MUTE SubBot] Verificando mute para ${ctx.sender.jid} en ${ctx.chat.jid}`);

        const isMuted = await serviceManager.moderationService.isMuted(
          ctx.chat.jid,
          ctx.sender.jid,
        );

        logger.debug(`[MUTE SubBot] Resultado: ${isMuted}`);

        if (isMuted) {
          const botJid = sock.user?.id ?? '';
          if (botJid) {
            cacheManager.invalidateGroupMetadata(ctx.chat.jid);
          }
          await ctx.loadBotPermissions();

          if (ctx.chat.isBotAdmin) {
            try {
              await sock.sendMessage(ctx.chat.jid, { delete: msg.key });
              logger.info(`[MUTE] Mensaje eliminado en SubBot: ${msg.key.id}`);
            } catch (error) {
              logError('[MUTE] Error al eliminar mensaje en SubBot', error);
            }
          }

          return;
        }
      }

      if (ctx.chat.isGroup && !ctx.command) {
        const isEnabled = await serviceManager.vaniaToggleService.isEnabled(ctx.chat.jid);
        if (!isEnabled) return;
        const quizHandled = await quizAnswerHandler.handle(ctx);
        if (quizHandled) return;
        const botJid = sock.user?.id ?? '';
        await handleMention(ctx, botJid);
        return;
      }

      if (!ctx.command) return;

      const antiSpam = this.antiSpamPerInstance.get(subConfig.id);
      if (antiSpam) {
        const rateLimit = antiSpam.check(ctx.sender.jid);
        if (!rateLimit.allowed) {
          await ctx.reply(rateLimit.reason ?? '⚠️ Demasiados mensajes').catch(() => {});
          return;
        }
      }

      const fullCommand = ctx.args.length > 0 ? `${ctx.command} ${ctx.args[0]}` : null;
      const command =
        (fullCommand ? commandRegistry.get(fullCommand) : null) ?? commandRegistry.get(ctx.command);

      if (!command) return;

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

      const middlewares = this.middlewaresPerInstance.get(subConfig.id) ?? [];
      await this.executeWithMiddlewares(ctx, middlewares, async () => {
        try {
          await command.execute(ctx);
          const processingTime = Date.now() - startTime;
          logger.info(`✅ SubBot[${subConfig.id}] cmd=${ctx.command} time=${processingTime}ms`);
          if (processingTime > 2000) {
            logger.warn(`⚠️ SubBot[${subConfig.id}] ${ctx.command}: ${processingTime}ms (lento)`);
          }
        } catch (error) {
          logError(`SubBot[${subConfig.id}]`, new CommandExecutionError(ctx.command, error));
          await ctx.reply('Ocurrió un error al ejecutar el comando 💔').catch(() => {});
        }
      });

      cacheManager.markMessageProcessed(messageId);
    } catch (error) {
      logError(`SubBot[${subConfig.id}].handleMessage`, error);
    }
  }

  private async handleGroupUpdate(update: GroupParticipantsUpdate, sock: WASocket): Promise<void> {
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
            .handleNewParticipant(sock, groupJid, participant)
            .catch(err => logError('SubBot.handleNewParticipant', err));
        }
      }
      if (action === 'remove') {
        for (const participant of participants) {
          welcomeService
            .handleParticipantLeft(sock, groupJid, participant)
            .catch(err => logError('SubBot.handleParticipantLeft', err));
        }
      }
    } catch (error) {
      logError('SubBot.handleGroupUpdate', error);
    }
  }

  private async executeWithMiddlewares(
    ctx: MessageContext,
    middlewares: MiddlewareConfig[],
    handler: () => Promise<void>,
  ): Promise<void> {
    let index = 0;
    const next = async (): Promise<void> => {
      const parallelBatch: IMiddleware[] = [];
      while (index < middlewares.length && middlewares[index].canRunParallel) {
        parallelBatch.push(middlewares[index].middleware);
        index++;
      }
      if (parallelBatch.length > 0) {
        await Promise.all(parallelBatch.map(mw => mw.execute(ctx, async () => {})));
      }
      if (index < middlewares.length) {
        const cfg = middlewares[index++];
        try {
          await cfg.middleware.execute(ctx, next);
        } catch (error) {
          logError(`SubBot.Middleware:${cfg.middleware.name}`, error);
          throw error;
        }
      } else {
        await handler();
      }
    };
    await next();
  }

  async stopSubBot(ownerJid: string): Promise<void> {
    const subConfig = subBotDatabase.getByOwner(ownerJid);
    if (!subConfig) throw new Error('No tienes una subbot registrada.');
    logger.info(`🛑 SubBot[${subConfig.id}] deteniendo por solicitud del owner`);
    const instance = this.instances.get(subConfig.id);
    if (instance) {
      await instance.stop();
      this.instances.delete(subConfig.id);
      this.middlewaresPerInstance.delete(subConfig.id);
      this.antiSpamPerInstance.delete(subConfig.id);
    }
    subBotDatabase.update(subConfig.id, { active: false, status: 'disconnected' });
  }

  async deleteSubBot(ownerJid: string): Promise<void> {
    const subConfig = subBotDatabase.getByOwner(ownerJid);
    if (!subConfig) throw new Error('No tienes una subbot registrada.');
    logger.info(`🗑️ SubBot[${subConfig.id}] eliminando...`);
    const instance = this.instances.get(subConfig.id);
    if (instance) {
      await instance.stop();
      instance.clearSession();
      this.instances.delete(subConfig.id);
      this.middlewaresPerInstance.delete(subConfig.id);
      this.antiSpamPerInstance.delete(subConfig.id);
    }
    if (existsSync(subConfig.sessionPath)) {
      try {
        rmSync(subConfig.sessionPath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors if session path doesn't exist
      }
    }
    subBotDatabase.delete(subConfig.id);
    logger.info(`✅ SubBot[${subConfig.id}] eliminada completamente`);
  }

  async reconnectSubBot(ownerJid: string): Promise<void> {
    const subConfig = subBotDatabase.getByOwner(ownerJid);
    if (!subConfig) throw new Error('No tienes una subbot registrada.');
    logger.info(`🔄 SubBot[${subConfig.id}] reconectando automáticamente...`);

    const instance = this.instances.get(subConfig.id);
    if (instance) {
      await instance.stop();
      this.instances.delete(subConfig.id);
      this.middlewaresPerInstance.delete(subConfig.id);
      this.antiSpamPerInstance.delete(subConfig.id);
    }

    subBotDatabase.update(subConfig.id, {
      active: true,
      status: 'connecting',
      pairingCode: undefined,
    });

    const fresh = subBotDatabase.get(subConfig.id);
    if (!fresh) {
      throw new Error('Subbot not found after update');
    }
    await this.launchInstance(fresh);
  }

  getStatus(ownerJid: string): SubBotStatus | null {
    const subConfig = subBotDatabase.getByOwner(ownerJid);
    if (!subConfig) return null;
    return {
      id: subConfig.id,
      status: subConfig.status,
      name: subConfig.name,
      phoneNumber: subConfig.phoneNumber,
      ownerJid: subConfig.ownerJid,
      connectedAt: subConfig.connectedAt,
    };
  }

  getAllStatus(): SubBotStatus[] {
    return subBotDatabase.getAll().map(s => ({
      id: s.id,
      status: s.status,
      name: s.name,
      phoneNumber: s.phoneNumber,
      ownerJid: s.ownerJid,
      connectedAt: s.connectedAt,
    }));
  }

  getTotalConnected(): number {
    return subBotDatabase.getAll().filter(s => s.status === 'connected').length;
  }

  private async notifyAdminsMute(ctx: MessageContext, sock: WASocket): Promise<void> {
    try {
      const admins = await PermissionService.getGroupAdmins(sock, ctx.chat.jid);
      const botJid = sock.user?.id;
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
          await sock.sendMessage(adminJid, {
            text:
              `🔇 *Aviso de Mute (SubBot)*\n\n` +
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

  async shutdown(): Promise<void> {
    logger.info(`🛑 SubBotManager cerrando ${this.instances.size} subbots...`);
    this.stopHealthCheck();
    const stops = Array.from(this.instances.values()).map(i => i.stop());
    await Promise.allSettled(stops);
    this.instances.clear();
    this.middlewaresPerInstance.clear();
    this.antiSpamPerInstance.clear();
    logger.info('✅ SubBotManager cerrada');
  }
}

export const subBotManager = SubBotManager.getInstance();
