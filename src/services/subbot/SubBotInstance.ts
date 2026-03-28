/**
 * SubBotInstance.ts
 *
 * Represents an individual subbot instance.
 * Handles WhatsApp connection via Baileys,
 * including authentication, reconnection, and event management.
 *
 * FIXES:
 * - Never requests a new pairing code if a session already exists
 * - sessionInvalidCount only increments on true loggedOut (401), not network errors
 * - Aggressive keep-alive to prevent silent disconnections
 * - scheduleReconnect never clears session automatically
 * - Only emits sessionInvalid after confirmed loggedOut (401) N times
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

// ─── Reconnection timing ───────────────────────────────────────────────────
const FIRST_RECONNECT_DELAY = 5_000; // 5s first retry (was 20s — too slow)
const MAX_RECONNECT_DELAY = 60_000; // 60s cap
const MAX_RECONNECT_ATTEMPTS = 50; // more attempts before giving up (was 25)

// ─── Keep-alive / health ──────────────────────────────────────────────────
const HEALTH_CHECK_INTERVAL = 120_000; // 2 min (was 10 min — too infrequent)
const PING_INTERVAL = 20_000; // 20s ping
const CONNECTION_VERIFY_DELAY = 5_000;

// ─── Session protection ───────────────────────────────────────────────────
/**
 * Number of consecutive TRUE loggedOut (401) events before we consider the
 * session permanently dead and request owner intervention.
 * Network blips produce badSession (500) not loggedOut, so this stays low.
 */
const MAX_TRUE_LOGOUT_BEFORE_INVALID = 2;

/**
 * Status codes that are ALWAYS network-related and should NEVER trigger
 * session cleanup or pairing-code requests.
 */
const NETWORK_ERROR_CODES = new Set([
  DisconnectReason.timedOut,
  DisconnectReason.connectionLost,
  DisconnectReason.connectionClosed,
  DisconnectReason.connectionReplaced,
  DisconnectReason.restartRequired,
  408, // Request Timeout
  503, // Service Unavailable
  502, // Bad Gateway
]);

export class SubBotInstance extends EventEmitter {
  public sock?: WASocket;
  public config: SubBotConfig;

  private reconnectAttempts = 0;
  private pairingCodeRequested = false;
  private connectionEstablished = false;
  private destroyed = false;
  private pairingCodeTimer?: NodeJS.Timeout;
  private pingInterval?: NodeJS.Timeout;
  private lastPingTime = 0;
  private healthCheckTimer?: NodeJS.Timeout;
  private isReconnecting = false;

  /**
   * True loggedOut (401) counter — incremented ONLY on statusCode 401.
   * NOT incremented on network errors, badSession or any other code.
   */
  private trueLogoutCount = 0;

  private hasNotifiedFirstConnection = false;
  private lastNotificationTime = 0;
  private readonly NOTIFICATION_COOLDOWN = 5 * 60 * 1000;

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
        logger.debug(`📶 SubBot[${this.config.id}] ping OK`);
      } catch {
        logger.debug(`⚠️ SubBot[${this.config.id}] ping failed (ignored)`);
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
        const isAlive = this.isSocketReallyConnected();
        if (!isAlive && this.connectionEstablished && !this.isReconnecting) {
          logger.warn(`⚠️ SubBot[${this.config.id}] health check: posible desconexión silenciosa`);
          setTimeout(() => {
            if (!this.isSocketReallyConnected() && !this.isReconnecting && !this.destroyed) {
              logger.warn(
                `⚠️ SubBot[${this.config.id}] desconexión silenciosa confirmada, reconectando...`,
              );
              this.connectionEstablished = false;
              this.scheduleReconnect();
            }
          }, CONNECTION_VERIFY_DELAY);
        } else if (isAlive) {
          logger.debug(`✅ SubBot[${this.config.id}] health check OK`);
        }
      } catch (error) {
        logger.debug(`⚠️ SubBot[${this.config.id}] error en health check: ${error}`);
      }
    }, HEALTH_CHECK_INTERVAL);
  }

  private isSocketReallyConnected(): boolean {
    if (!this.sock || this.destroyed) return false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const socket = this.sock as any;
      if (!socket.ws) return false;
      if (socket.ws.readyState !== 1 /* OPEN */) return false;
      if (!this.sock.user?.id) return false;
      if (!this.connectionEstablished) return false;
      return true;
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

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.warn(
        `⚠️ SubBot[${this.config.id}] alcanzó ${MAX_RECONNECT_ATTEMPTS} reintentos, ` +
          `esperando 5 min y reseteando contador...`,
      );
      // NEVER clear session here — just back off and keep trying
      this.reconnectAttempts = 0;
      subBotDatabase.update(this.config.id, { status: 'connecting' });
      setTimeout(
        () => {
          if (!this.destroyed) {
            this.connectionEstablished = false;
            void this.start();
          }
        },
        5 * 60 * 1000,
      );
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    const delay = Math.min(
      FIRST_RECONNECT_DELAY * Math.pow(1.5, this.reconnectAttempts - 1),
      MAX_RECONNECT_DELAY,
    );

    logger.info(
      `🔄 SubBot[${this.config.id}] reconectando en ${Math.round(delay / 1000)}s ` +
        `(intento ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
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

  async start(): Promise<void> {
    if (this.destroyed) return;
    this.pairingCodeRequested = false;

    logger.info(
      `🌸 SubBot[${this.config.id}] starting (${this.config.name} | ${this.config.phoneNumber})`,
    );

    try {
      mkdirSync(this.config.sessionPath, { recursive: true });
      const { version } = await fetchLatestBaileysVersion();
      const { state, saveCreds } = await useMultiFileAuthState(this.config.sessionPath);

      const hasExistingCreds = !!state.creds.registered;
      logger.debug(
        `🌸 SubBot[${this.config.id}] session: ${hasExistingCreds ? 'existing ✅' : 'new 🆕'}`,
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
        keepAliveIntervalMs: 15_000, // más frecuente que antes
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

      if (!hasExistingCreds) {
        logger.info(
          `🔑 SubBot[${this.config.id}] sin credenciales, solicitando código de pareamiento...`,
        );
        // Wait a bit longer (8s) for the socket to stabilize before requesting
        this.pairingCodeTimer = setTimeout(() => {
          if (!this.destroyed && this.sock && !this.sock.authState.creds.registered) {
            void this.requestPairingCode();
          }
        }, 8_000);
      } else {
        // Existing session — just wait for 'open', never ask for a code
        logger.info(
          `✅ SubBot[${this.config.id}] sesión existente, esperando reconexión automática...`,
        );
      }
    } catch (error) {
      logError(`SubBot[${this.config.id}].start`, error);
      subBotDatabase.update(this.config.id, { status: 'error' });
      this.emit('status', 'error');
      // Retry even on unexpected start errors
      this.scheduleReconnect();
    }
  }

  private async handleConnection(update: Partial<ConnectionState>): Promise<void> {
    const { connection, lastDisconnect } = update;

    logger.debug(
      `🔍 SubBot[${this.config.id}] update: connection=${connection ?? 'none'} | ` +
        `registered=${this.sock?.authState?.creds?.registered} | ` +
        `established=${this.connectionEstablished}`,
    );

    if (lastDisconnect?.error) {
      const err = lastDisconnect.error as { output?: { statusCode?: number }; message?: string };
      const statusCode = err?.output?.statusCode;

      logger.warn(
        `🔍 SubBot[${this.config.id}] lastDisconnect: status=${statusCode} msg=${err?.message}`,
      );

      // ── True loggedOut (401) — the only code that indicates a dead session ──
      if (statusCode === DisconnectReason.loggedOut) {
        this.trueLogoutCount++;
        logger.warn(
          `⚠️ SubBot[${this.config.id}] loggedOut 401 ` +
            `(${this.trueLogoutCount}/${MAX_TRUE_LOGOUT_BEFORE_INVALID})`,
        );

        if (this.trueLogoutCount >= MAX_TRUE_LOGOUT_BEFORE_INVALID) {
          logger.error(
            `❌ SubBot[${this.config.id}] sesión definitivamente revocada por WhatsApp, ` +
              `limpiando y notificando owner...`,
          );
          this.clearSession();
          this.emit('sessionInvalid');
          return;
        }

        // First logout — could be a transient WA server issue; retry once
        const delay = 20_000;
        logger.info(`🔄 SubBot[${this.config.id}] reintentando en ${delay / 1000}s...`);
        setTimeout(() => {
          if (!this.destroyed) {
            this.connectionEstablished = false;
            void this.start();
          }
        }, delay);
        return;
      }

      // ── badSession (500) — DO NOT clear session, just reconnect ──
      if (statusCode === DisconnectReason.badSession) {
        logger.warn(
          `⚠️ SubBot[${this.config.id}] badSession — error temporal, reconectando sin limpiar sesión`,
        );
        this.scheduleReconnect();
        return;
      }

      // ── All network errors — transparent reconnect ──
      if (NETWORK_ERROR_CODES.has(statusCode as number)) {
        logger.info(`🌐 SubBot[${this.config.id}] error de red (${statusCode}), reconectando...`);
        // Let Baileys handle timedOut/connectionLost natively; only force if closed
        if (connection === 'close') this.scheduleReconnect();
        return;
      }
    }

    if (connection === 'connecting') {
      logger.debug(`🔄 SubBot[${this.config.id}] connecting...`);
      return;
    }

    if (connection === 'open') {
      logger.info(`✅ SubBot[${this.config.id}] connection open`);
      this.trueLogoutCount = 0;
      this.reconnectAttempts = 0;

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

      const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output
        ?.statusCode;
      logger.warn(`⚠️ SubBot[${this.config.id}] connection closed, code: ${statusCode}`);

      if (this.destroyed) return;

      // If we never got 'open', back off but keep trying
      if (!this.connectionEstablished) {
        if (this.isReconnecting) return;
        logger.debug(
          `⚠️ SubBot[${this.config.id}] conexión nunca establecida, reintentando en 10s...`,
        );
        subBotDatabase.update(this.config.id, { status: 'connecting' });
        setTimeout(() => {
          if (!this.destroyed && !this.isReconnecting) void this.start();
        }, 10_000);
        return;
      }

      this.scheduleReconnect();
    }
  }

  // ─── onFullyConnected ────────────────────────────────────────────────────

  private async onFullyConnected(): Promise<void> {
    this.reconnectAttempts = 0;
    this.trueLogoutCount = 0;
    this.connectionEstablished = true;
    this.pairingCodeRequested = false;

    this.startPing();
    this.startHealthCheck();

    subBotDatabase.update(this.config.id, {
      status: 'connected',
      connectedAt: Date.now(),
      active: true,
    });

    logger.info(`✅ SubBot[${this.config.id}] (${this.config.name}) operational 🌸`);
    this.emit('status', 'connected');

    const now = Date.now();
    const shouldNotify =
      !this.hasNotifiedFirstConnection ||
      now - this.lastNotificationTime > this.NOTIFICATION_COOLDOWN;

    if (shouldNotify) {
      this.hasNotifiedFirstConnection = true;
      this.lastNotificationTime = now;
      this.emit('ready');
    }
  }

  // ─── Pairing code (only for brand-new sessions) ───────────────────────────

  private async requestPairingCode(): Promise<void> {
    if (!this.sock || this.destroyed) return;
    if (this.pairingCodeRequested) return;
    if (this.sock.authState.creds.registered) {
      logger.debug(`ℹ️ SubBot[${this.config.id}] already registered, skipping pairing code`);
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

      logger.info(`🔑 SubBot[${this.config.id}] code: ${formatted}`);
      this.emit('pairingCode', formatted);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`❌ SubBot[${this.config.id}] error requesting code: ${msg}`);

      if (
        msg.includes('Connection Closed') ||
        msg.includes('timed out') ||
        msg.includes('Timeout')
      ) {
        this.pairingCodeRequested = false;
        if (!this.destroyed) {
          this.pairingCodeTimer = setTimeout(() => {
            if (!this.sock?.authState.creds.registered) void this.requestPairingCode();
          }, 5_000);
        }
      } else {
        logError(`SubBot[${this.config.id}].requestPairingCode`, error);
        this.pairingCodeRequested = false;
        this.emit('pairingCodeError', error);
      }
    }
  }

  // ─── Stop / cleanup ───────────────────────────────────────────────────────

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

  clearSession(): void {
    logger.info(`🧹 SubBot[${this.config.id}] clearing session...`);
    try {
      if (!existsSync(this.config.sessionPath)) return;
      const files = readdirSync(this.config.sessionPath);
      for (const file of files) {
        try {
          unlinkSync(join(this.config.sessionPath, file));
        } catch {
          /* ignore */
        }
      }
      logger.info(`✅ SubBot[${this.config.id}] session cleared (${files.length} files)`);
    } catch (err) {
      logError(`SubBot[${this.config.id}].clearSession`, err);
    }
  }

  isConnected(): boolean {
    if (this.config.status !== 'connected' || !this.sock || this.destroyed) return false;
    return this.isSocketReallyConnected();
  }
}
