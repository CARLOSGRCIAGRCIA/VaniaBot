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
  private maxReconnectAttempts = 10;
  private pairingCodeRequested = false;
  private connectionEstablished = false;
  private destroyed = false;
  private pairingCodeTimer?: NodeJS.Timeout;

  /**
   * Creates a new subbot instance.
   *
   * @param config - The subbot configuration
   */
  constructor(config: SubBotConfig) {
    super();
    this.config = config;
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
      logger.debug(
        `🌸 SubBot[${this.config.id}] session: ${state.creds.registered ? 'existing ✅' : 'new 🆕'}`,
      );

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
        saveCreds().catch(() => {});
      });

      this.sock.ev.on('connection.update', update => {
        void this.handleConnection(update);
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
        logger.debug(`🔑 SubBot[${this.config.id}] new session, requesting code in 2s...`);
        if (this.pairingCodeTimer) clearTimeout(this.pairingCodeTimer);
        this.pairingCodeTimer = setTimeout(() => {
          void this.requestPairingCode();
        }, 2000);
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
   *
   * @param update - The connection state update
   * @returns Promise<void>
   */
  private async handleConnection(update: Partial<ConnectionState>): Promise<void> {
    const { connection, lastDisconnect } = update;

    logger.debug(
      `🔍 SubBot[${this.config.id}] update: connection=${connection ?? 'none'} | ` +
        `registered=${this.sock?.authState.creds.registered} | ` +
        `pairingRequested=${this.pairingCodeRequested} | ` +
        `established=${this.connectionEstablished}`,
    );

    if (lastDisconnect?.error) {
      const err = lastDisconnect.error as { output?: { statusCode?: number }; message?: string };
      logger.warn(
        `🔍 SubBot[${this.config.id}] lastDisconnect: status=${err?.output?.statusCode} msg=${err?.message}`,
      );
    }

    if (connection === 'connecting') {
      logger.debug(`🔄 SubBot[${this.config.id}] connecting to WhatsApp...`);
      return;
    }

    if (connection === 'open') {
      logger.info(`✅ SubBot[${this.config.id}] connection open`);
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

      if (statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.badSession) {
        logger.error(`❌ SubBot[${this.config.id}] invalid session (${statusCode})`);
        subBotDatabase.update(this.config.id, { status: 'disconnected', active: false });
        this.emit('status', 'disconnected');
        this.emit('sessionInvalid');
        return;
      }

      if (statusCode === 401 && !this.connectionEstablished) {
        logger.warn(`⚠️ SubBot[${this.config.id}] code expired, clearing and retrying...`);
        this.pairingCodeRequested = false;
        this.clearSession();

        if (!this.destroyed && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          logger.info(
            `🔄 SubBot[${this.config.id}] retry ${this.reconnectAttempts}/${this.maxReconnectAttempts} in 5s`,
          );
          setTimeout(() => {
            void this.start();
          }, 5000);
        } else {
          logger.error(`❌ SubBot[${this.config.id}] too many retries`);
          subBotDatabase.update(this.config.id, { status: 'error', active: false });
          this.emit('status', 'error');
        }
        return;
      }

      if (!this.destroyed && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(5000 * this.reconnectAttempts, 30000);
        logger.warn(
          `🔄 SubBot[${this.config.id}] reconnecting [${this.reconnectAttempts}/${this.maxReconnectAttempts}] in ${delay / 1000}s`,
        );
        subBotDatabase.update(this.config.id, { status: 'connecting' });
        this.emit('status', 'connecting');
        setTimeout(() => {
          void this.start();
        }, delay);
      } else if (!this.destroyed) {
        logger.error(`❌ SubBot[${this.config.id}] too many failed attempts`);
        subBotDatabase.update(this.config.id, { status: 'error', active: false });
        this.emit('status', 'error');
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
    this.connectionEstablished = true;
    this.pairingCodeRequested = false;

    subBotDatabase.update(this.config.id, {
      status: 'connected',
      connectedAt: Date.now(),
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
    if (this.pairingCodeTimer) {
      clearTimeout(this.pairingCodeTimer);
      this.pairingCodeTimer = undefined;
    }
    try {
      await this.sock?.ws?.close();
    } catch {}
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
        } catch {}
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
    return this.config.status === 'connected' && !!this.sock;
  }
}
