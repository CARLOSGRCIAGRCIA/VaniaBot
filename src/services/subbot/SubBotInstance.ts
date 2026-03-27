/**
 * SubBotInstance.ts
 *
 * Represents an individual subbot instance.
 * Handles WhatsApp connection via Baileys,
 * including authentication, reconnection, and event management.
 *
 * @author **Carlos G** ⭐
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import makeWASocket, {
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
  type ConnectionState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { EventEmitter } from 'events';
import type { SubBotConfig } from '@/types/subbot.js';
import { subBotDatabase } from './SubBotDatabase.js';
import { logger, logError } from '@/utils/logger.js';
import { cacheManager } from '@/core/CacheManager.js';

const SILENT_LOGGER = pino({ level: 'silent' });

const FIRST_RECONNECT_DELAY = 10000;
const MAX_RECONNECT_DELAY = 60000;
const MAX_RECONNECT_ATTEMPTS = 15;
const HEALTH_CHECK_INTERVAL = 120000;
const PING_INTERVAL = 25000;

/**
 * Individual subbot instance.
 * Each subbot has its own WhatsApp connection.
 *
 * @example
 * ```typescript
 * const instance = new SubBotInstance(config);
 * instance.on('ready', () => console.log('Connected'));
 * await instance.start();
 * ```
 */
export class SubBotInstance extends EventEmitter {
  /** The Baileys socket for this subbot */
  public sock?: WASocket;
  /** Configuration for this subbot */
  public config: SubBotConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = MAX_RECONNECT_ATTEMPTS;
  private pairingCodeRequested = false;
  private connectionEstablished = false;
  private destroyed = false;
  private pairingCodeTimer?: NodeJS.Timeout;
  private pingInterval?: NodeJS.Timeout;
  private lastPingTime = 0;
  private healthCheckTimer?: NodeJS.Timeout;
  private isReconnecting = false;
  private sessionInvalidCount = 0;
  private maxSessionInvalidAttempts = 3;
  private needsNewCode = false;

  /**
   * Creates a new subbot instance.
   *
   * @param config - The subbot configuration
   */
  constructor(config: SubBotConfig) {
    super();
    this.config = config;
  }

  private startPing(): void {
    if (this.pingInterval) return;

    this.pingInterval = setInterval(async () => {
      if (!this.sock || this.destroyed) return;

      try {
        await this.sock.sendPresenceUpdate('available', 'status@broadcast');
        this.lastPingTime = Date.now();
        logger.debug(`📶 SubBot[${this.config.id}] ping enviado`);
      } catch {
        logger.debug(`⚠️ SubBot[${this.config.id}] error en ping (ignorado)`);
      }
    }, PING_INTERVAL);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }

  private startHealthCheck(): void {
    if (this.healthCheckTimer) return;

    this.healthCheckTimer = setInterval(async () => {
      if (!this.sock || this.destroyed) return;

      try {
        if (!this.sock.user?.id) {
          logger.warn(`⚠️ SubBot[${this.config.id}] sin usuario, verificando conexión...`);
          if (!this.connectionEstablished) {
            logger.debug(`⚠️ SubBot[${this.config.id}] sin conexión establecida`);
            return;
          }
        }

        const isAlive = this.isSocketReallyConnected();
        if (!isAlive && !this.isReconnecting) {
          logger.warn(`⚠️ SubBot[${this.config.id}] socket detectado como muerto, reconectando...`);
          this.scheduleReconnect();
          return;
        }

        logger.debug(`✅ SubBot[${this.config.id}] health check OK`);
      } catch (error) {
        logger.debug(`⚠️ SubBot[${this.config.id}] error en health check: ${error}`);
      }
    }, HEALTH_CHECK_INTERVAL);
  }

  private isSocketReallyConnected(): boolean {
    if (!this.sock || this.destroyed) return false;

    try {
      const socket = this.sock as any;
      if (!socket.ws || socket.ws.readyState !== 1) return false;
      if (!this.sock.user?.id) return false;
      return this.connectionEstablished;
    } catch {
      return false;
    }
  }

  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.isReconnecting) return;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(`❌ SubBot[${this.config.id}] demasiados reintentos de reconexión`);
      if (this.sessionInvalidCount >= this.maxSessionInvalidAttempts) {
        logger.error(
          `❌ SubBot[${this.config.id}] sesión aparentemente inservible, solicitando nuevo código`,
        );
        this.needsNewCode = true;
        this.emit('sessionInvalid');
        return;
      }

      logger.info(`🔄 SubBot[${this.config.id}] resetando intentos, reintentando en 2min...`);
      this.reconnectAttempts = 0;
      subBotDatabase.update(this.config.id, { status: 'connecting' });

      setTimeout(() => {
        if (!this.destroyed) {
          this.connectionEstablished = false;
          void this.start();
        }
      }, 120000);
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    const delay = Math.min(
      FIRST_RECONNECT_DELAY * Math.pow(1.5, this.reconnectAttempts - 1),
      MAX_RECONNECT_DELAY,
    );

    logger.info(
      `🔄 SubBot[${this.config.id}] reconectando en ${Math.round(delay / 1000)}s (intento ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );
    subBotDatabase.update(this.config.id, { status: 'connecting' });

    setTimeout(() => {
      this.isReconnecting = false;
      if (!this.destroyed) {
        this.connectionEstablished = false;
        void this.start();
      }
    }, delay);
  }

  /**
   * Starts the subbot connection to WhatsApp.
   * Creates the socket, sets up event listeners, and handles authentication.
   *
   * @returns Promise<void>
   * @throws Error if connection fails
   */
  async start(): Promise<void> {
    if (this.destroyed) return;

    this.pairingCodeRequested = false;

    logger.info(
      `🌸 SubBot[${this.config.id}] starting (${this.config.name} | ${this.config.phoneNumber})`,
    );

    try {
      mkdirSync(this.config.sessionPath, { recursive: true });

      const { version } = await fetchLatestBaileysVersion();
      logger.debug(`🌸 SubBot[${this.config.id}] WA version ${version.join('.')}`);

      const { state, saveCreds } = await useMultiFileAuthState(this.config.sessionPath);
      const hasExistingCreds = !!state.creds.registered;

      logger.debug(
        `🌸 SubBot[${this.config.id}] session: ${hasExistingCreds ? 'existing ✅' : 'new 🆕'}`,
      );

      if (!hasExistingCreds && !this.needsNewCode) {
        logger.info(
          `🔑 SubBot[${this.config.id}] sin credenciales, esperando código de vinculación...`,
        );
      }

      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, SILENT_LOGGER),
        },
        logger: SILENT_LOGGER,
        printQRInTerminal: false,
        browser: ['Ubuntu', 'Chrome', '120.0.0'],
        defaultQueryTimeoutMs: 60_000,
        connectTimeoutMs: 120_000,
        keepAliveIntervalMs: 20_000,
        getMessage: async () => undefined,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: false,
        retryRequestDelayMs: 250,
        shouldIgnoreJid: (jid: string) => jid?.endsWith('@broadcast'),
        emitOwnEvents: false,
        cachedGroupMetadata: async () => undefined,
      });

      this.sock.ev.on('creds.update', () => {
        saveCreds().catch(err => logError(`SubBotInstance[${this.config.id}].saveCreds`, err));
        if (!this.connectionEstablished && this.sock?.authState?.creds?.registered) {
          logger.info(`🔗 SubBot[${this.config.id}] device registered after code entry`);
          this.connectionEstablished = true;
          void this.onFullyConnected();
        }
      });

      this.sock.ev.on('connection.update', update => {
        void this.handleConnection(update).catch(err =>
          logError(`SubBotInstance[${this.config.id}].handleConnection`, err),
        );
      });

      this.sock.ev.on('messages.upsert', ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const msg of messages) {
          if (!msg.message || msg.key.fromMe) continue;
          this.emit('message', msg, this.sock);
        }
      });

      this.sock.ev.on('group-participants.update', update => {
        this.emit('groupUpdate', update);
      });

      this.sock.ev.on('groups.update', updates => {
        for (const update of updates) {
          if (update.id) cacheManager.invalidateGroupMetadata(update.id);
        }
      });

      subBotDatabase.update(this.config.id, { status: 'connecting' });
      this.emit('status', 'connecting');
      logger.debug(`🌸 SubBot[${this.config.id}] socket created, waiting for connection...`);

      if (!state.creds.registered) {
        logger.debug(
          `🔑 SubBot[${this.config.id}] new session, will request code after connection stabilizes`,
        );
        this.pairingCodeTimer = setTimeout(() => {
          if (!this.destroyed && this.sock) {
            logger.debug(`🔑 SubBot[${this.config.id}] requesting pairing code now...`);
            void this.requestPairingCode();
          }
        }, 3000);
      }
    } catch (error) {
      logError(`SubBot[${this.config.id}].start`, error);
      subBotDatabase.update(this.config.id, { status: 'error' });
      this.emit('status', 'error');
    }
  }

  /**
   * Handles connection state updates from Baileys.
   * Manages reconnection logic and status changes.
   * AUTO-RECONNECTS without user intervention!
   *
   * @param update - The connection state update
   * @returns Promise<void>
   */
  private async handleConnection(update: Partial<ConnectionState>): Promise<void> {
    const { connection, lastDisconnect } = update;

    logger.debug(
      `🔍 SubBot[${this.config.id}] update: connection=${connection ?? 'none'} | ` +
        `registered=${this.sock?.authState?.creds?.registered} | ` +
        `pairingRequested=${this.pairingCodeRequested} | ` +
        `established=${this.connectionEstablished}`,
    );

    if (lastDisconnect?.error) {
      const err = lastDisconnect.error as { output?: { statusCode?: number }; message?: string };
      const statusCode = err?.output?.statusCode;
      logger.warn(
        `🔍 SubBot[${this.config.id}] lastDisconnect: status=${statusCode} msg=${err?.message}`,
      );

      if (statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.badSession) {
        this.sessionInvalidCount++;
        logger.warn(
          `⚠️ SubBot[${this.config.id}] sesión inválida detectada (intento ${this.sessionInvalidCount}/${this.maxSessionInvalidAttempts})`,
        );

        if (this.sessionInvalidCount >= this.maxSessionInvalidAttempts) {
          logger.error(
            `❌ SubBot[${this.config.id}] sesión definitivamente inválida, limpiando y reintentando...`,
          );
          this.clearSession();
          this.needsNewCode = true;
          this.emit('sessionInvalid');
          return;
        }

        logger.info(`🔄 SubBot[${this.config.id}] intentando reconectar con sesión limpia...`);
        setTimeout(() => {
          if (!this.destroyed) {
            this.clearSession();
            this.connectionEstablished = false;
            void this.start();
          }
        }, 5000);
        return;
      }
    }

    if (connection === 'connecting') {
      logger.debug(`🔄 SubBot[${this.config.id}] connecting to WhatsApp...`);
      return;
    }

    if (connection === 'open') {
      logger.info(`✅ SubBot[${this.config.id}] connection open`);
      this.sessionInvalidCount = 0;
      this.needsNewCode = false;

      if (this.pairingCodeTimer) {
        clearTimeout(this.pairingCodeTimer);
        this.pairingCodeTimer = undefined;
      }
      await this.onFullyConnected();
      return;
    }

    if (connection === 'close') {
      if (this.pairingCodeTimer) {
        clearTimeout(this.pairingCodeTimer);
        this.pairingCodeTimer = undefined;
      }

      const error = lastDisconnect?.error as { output?: { statusCode?: number } } | undefined;
      const statusCode = error?.output?.statusCode;

      logger.warn(`⚠️ SubBot[${this.config.id}] connection closed, code: ${statusCode}`);

      if (!this.connectionEstablished) {
        logger.debug(
          `⚠️ SubBot[${this.config.id}] conexión nunca establecida, reintentando automáticamente...`,
        );
        subBotDatabase.update(this.config.id, { status: 'connecting' });

        const delay = Math.min(5000 * (this.sessionInvalidCount + 1), 15000);
        setTimeout(() => {
          if (!this.destroyed) {
            void this.start();
          }
        }, delay);
        return;
      }

      if (!this.destroyed) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Called when the subbot is fully connected.
   * Updates status and emits ready event.
   *
   * @returns Promise<void>
   */
  private async onFullyConnected(): Promise<void> {
    this.reconnectAttempts = 0;
    this.sessionInvalidCount = 0;
    this.connectionEstablished = true;
    this.pairingCodeRequested = false;
    this.needsNewCode = false;

    this.startPing();
    this.startHealthCheck();

    subBotDatabase.update(this.config.id, {
      status: 'connected',
      connectedAt: Date.now(),
      active: true,
    });

    logger.info(`✅ SubBot[${this.config.id}] (${this.config.name}) operational and ready 🌸`);
    this.emit('status', 'connected');
    this.emit('ready');
  }

  /**
   * Requests a pairing code from WhatsApp for authentication.
   * Emits the code via event for the owner to enter on their device.
   *
   * @returns Promise<void>
   * @throws Error if code request fails
   */
  private async requestPairingCode(): Promise<void> {
    if (!this.sock || this.destroyed) {
      logger.warn(
        `⚠️ SubBot[${this.config.id}] cannot request code: sock=${!!this.sock} destroyed=${this.destroyed}`,
      );
      return;
    }

    if (this.pairingCodeRequested) {
      logger.warn(`⚠️ SubBot[${this.config.id}] code already requested, ignoring`);
      return;
    }

    if (this.sock.authState.creds.registered) {
      logger.debug(`ℹ️ SubBot[${this.config.id}] already registered, no code needed`);
      return;
    }

    this.pairingCodeRequested = true;

    try {
      const phone = this.config.phoneNumber.replace(/\D/g, '');
      logger.debug(`📞 SubBot[${this.config.id}] requesting pairing code for +${phone}...`);

      const code = await this.sock.requestPairingCode(phone);
      if (!code) throw new Error('WhatsApp did not return code');

      const formatted = code.match(/.{1,4}/g)?.join('-') ?? code;

      subBotDatabase.update(this.config.id, {
        pairingCode: formatted,
        pairingCodeRequestedAt: Date.now(),
      });

      logger.info(`🔑 SubBot[${this.config.id}] code obtained: ${formatted}`);
      this.emit('pairingCode', formatted);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`❌ SubBot[${this.config.id}] error requesting code: ${msg}`);

      if (
        msg.includes('Connection Closed') ||
        msg.includes('timed out') ||
        msg.includes('Timeout')
      ) {
        logger.debug(`🔄 SubBot[${this.config.id}] retrying code in 3s...`);
        this.pairingCodeRequested = false;
        if (!this.destroyed) {
          this.pairingCodeTimer = setTimeout(() => {
            void this.requestPairingCode();
          }, 3000);
        }
      } else {
        logError(`SubBot[${this.config.id}].requestPairingCode`, error);
        this.pairingCodeRequested = false;
        this.emit('pairingCodeError', error);
      }
    }
  }

  /**
   * Stops the subbot and disconnects from WhatsApp.
   *
   * @returns Promise<void>
   */
  async stop(): Promise<void> {
    logger.info(`🛑 SubBot[${this.config.id}] stopping...`);
    this.destroyed = true;

    this.stopPing();
    this.stopHealthCheck();

    if (this.pairingCodeTimer) {
      clearTimeout(this.pairingCodeTimer);
      this.pairingCodeTimer = undefined;
    }
    if (this.sock?.ev) {
      this.sock.ev.removeAllListeners('creds.update');
      this.sock.ev.removeAllListeners('connection.update');
      this.sock.ev.removeAllListeners('messages.upsert');
      this.sock.ev.removeAllListeners('group-participants.update');
      this.sock.ev.removeAllListeners('groups.update');
    }
    try {
      await this.sock?.ws?.close();
    } catch (err) {
      logError(`SubBotInstance[${this.config.id}].stop`, err);
    }
    subBotDatabase.update(this.config.id, { status: 'disconnected' });
    this.emit('status', 'disconnected');
    logger.info(`✅ SubBot[${this.config.id}] stopped`);
  }

  /**
   * Clears all session files for this subbot.
   * Used when session becomes invalid or for re-authentication.
   *
   * @returns void
   */
  clearSession(): void {
    logger.info(`🧹 SubBot[${this.config.id}] clearing session...`);
    try {
      if (!existsSync(this.config.sessionPath)) return;
      const files = readdirSync(this.config.sessionPath);
      for (const file of files) {
        try {
          unlinkSync(join(this.config.sessionPath, file));
        } catch {
          // Ignore file deletion errors during cleanup
        }
      }
      logger.info(`✅ SubBot[${this.config.id}] session cleared (${files.length} files)`);
    } catch (err) {
      logError(`SubBot[${this.config.id}].clearSession`, err);
    }
  }

  /**
   * Checks if the subbot is currently connected.
   *
   * @returns true if connected, false otherwise
   */
  isConnected(): boolean {
    if (this.config.status !== 'connected' || !this.sock || this.destroyed) {
      return false;
    }
    return this.isSocketReallyConnected();
  }
}
