/**
 * SubBotInstance.ts
 *
 * Represents an individual subbot instance.
 * Handles WhatsApp connection via Baileys,
 * including authentication, reconnection, and event management.
 *
 * KEY BEHAVIORS:
 * - 440 (conflict): cierra el socket viejo, espera 15s y reconecta UNA sola vez
 * - Nunca pide código de pareamiento si ya existe sesión
 * - 401 (loggedOut): limpia sesión solo tras N confirmaciones reales
 * - 'ready' solo se emite una vez por sesión (no en cada reconexión)
 * - No hay spam de notificaciones al owner durante reconexiones
 *
 * @author **Carlos G** ⭐
 * @github CARLOSGRCIAGRCIA
 */
import makeWASocket, {
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
import { useEncryptedMultiFileAuthState } from './EncryptedAuthState.js';
import { logger, logError } from '@/utils/logger.js';
import { cacheManager } from '@/core/CacheManager.js';

const SILENT_LOGGER = pino({ level: 'silent' });

// ─── Timing constants ────────────────────────────────────────────────────────
const FIRST_RECONNECT_DELAY = 15_000;
const MAX_RECONNECT_DELAY = 120_000;
const MAX_RECONNECT_ATTEMPTS = 50;

// 440 conflict: tiempo que WA necesita para cerrar la sesión conflictiva
const CONFLICT_RECONNECT_DELAY = 20_000;

// Health-check: intervalo entre revisiones y tiempo de confirmación antes
// de reconectar (evita falsos positivos por prekey bundle / GC pause / RAM)
const HEALTH_CHECK_INTERVAL = 10 * 60_000; // revisar cada 10 min
const HEALTH_CHECK_CONFIRM_WAIT = 20_000; // esperar 20s antes de reconectar
const PING_INTERVAL = 30_000;

const MAX_TRUE_LOGOUTS = 2;

// Códigos de error de red puros — nunca indican sesión inválida
const NETWORK_CODES = new Set<number>([
  DisconnectReason.timedOut,
  DisconnectReason.connectionLost,
  DisconnectReason.connectionClosed,
  DisconnectReason.connectionReplaced,
  DisconnectReason.restartRequired,
  408,
  502,
  503,
]);

// 440 = "Stream Errored (conflict)" — WA detecta dos conexiones del mismo número
const CONFLICT_CODE = 440;

export class SubBotInstance extends EventEmitter {
  public sock?: WASocket;
  public config: SubBotConfig;
  public pairingCode?: string;

  private reconnectAttempts = 0;
  private pairingCodeRequested = false;
  private connectionEstablished = false;
  private destroyed = false;
  private pairingCodeTimer?: NodeJS.Timeout;
  private pingInterval?: NodeJS.Timeout;
  private healthCheckTimer?: NodeJS.Timeout;
  private isReconnecting = false;
  private trueLogoutCount = 0;

  /**
   * true = el owner ya recibió "SubBot activada".
   * Solo se resetea en clearSession() para re-vincular.
   */
  private hasNotifiedReady = false;

  constructor(config: SubBotConfig) {
    super();
    this.config = config;
  }

  // ─── Keep-alive ──────────────────────────────────────────────────────────────

  private startPing(): void {
    if (this.pingInterval) return;
    this.pingInterval = setInterval(async () => {
      if (!this.sock || this.destroyed) return;
      // Solo intentar ping si el socket parece abierto — evitar errores en logs
      // durante transiciones de estado (prekey bundle, renegociación, etc.)
      try {
        const ws = (this.sock as any).ws;
        if (ws?.readyState !== 1) return; // no intentar si no está OPEN
        await this.sock.sendPresenceUpdate('available', 'status@broadcast');
      } catch {
        /* non-critical */
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
    this.healthCheckTimer = setInterval(() => {
      if (!this.sock || this.destroyed || this.isReconnecting) return;

      // Primera lectura: socket parece caído
      if (!this.isSocketReallyConnected() && this.connectionEstablished) {
        logger.warn(
          `⚠️ SubBot[${this.config.id}] health-check: socket inestable, ` +
            `verificando en ${HEALTH_CHECK_CONFIRM_WAIT / 1000}s...`,
        );

        // Segunda lectura tras HEALTH_CHECK_CONFIRM_WAIT:
        // Si Baileys estaba en renegociación (prekey bundle, GC pause, RAM alta)
        // ya se habrá recuperado solo y NO reconectamos innecesariamente.
        setTimeout(() => {
          if (this.destroyed || this.isReconnecting) return;
          if (!this.isSocketReallyConnected() && this.connectionEstablished) {
            logger.warn(
              `⚠️ SubBot[${this.config.id}] health-check: desconexión confirmada, reconectando`,
            );
            this.connectionEstablished = false;
            this.scheduleReconnect();
          } else {
            logger.debug(`✅ SubBot[${this.config.id}] health-check: socket se recuperó solo`);
          }
        }, HEALTH_CHECK_CONFIRM_WAIT);
      }
    }, HEALTH_CHECK_INTERVAL);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  private isSocketReallyConnected(): boolean {
    if (!this.sock || this.destroyed) return false;
    try {
      // Verificar múltiples condiciones para evitar falsos positivos
      if (!this.sock.user?.id) return false;

      const ws = (this.sock as any).ws;
      const readyState = ws?.readyState;

      // readyState: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
      // Solo confirmamos desconexión si está en CLOSED (3) o sin user.id
      if (readyState === 3) return false;

      // Si está CONNECTING o CLOSING, esperamos - no reconectamos todavía
      if (readyState === 0 || readyState === 2) {
        logger.debug(`SubBot[${this.config.id}] socket en estado transitorio: ${readyState}`);
        return true; // Consideramos conectado mientras transiciona
      }

      // readyState === 1 (OPEN) y tenemos user.id = conectado
      return readyState === 1;
    } catch {
      return false;
    }
  }

  // ─── Cerrar socket actual limpiamente ────────────────────────────────────────

  private async closeCurrentSocket(): Promise<void> {
    if (!this.sock) return;
    const old = this.sock;
    this.sock = undefined;
    try {
      old.ev.removeAllListeners('creds.update');
      old.ev.removeAllListeners('connection.update');
      old.ev.removeAllListeners('messages.upsert');
      old.ev.removeAllListeners('group-participants.update');
      old.ev.removeAllListeners('groups.update');
    } catch {
      /* ignore */
    }
    try {
      await old.ws?.close();
    } catch {
      /* ignore */
    }
  }

  // ─── Reconexión con back-off ─────────────────────────────────────────────────

  private scheduleReconnect(fixedDelay?: number): void {
    if (this.destroyed || this.isReconnecting) return;

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.warn(`⚠️ SubBot[${this.config.id}] ${MAX_RECONNECT_ATTEMPTS} reintentos, pausa 5 min`);
      this.reconnectAttempts = 0;
      subBotDatabase.update(this.config.id, { status: 'connecting' });
      setTimeout(() => {
        if (!this.destroyed) void this.start();
      }, 5 * 60_000);
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    const delay =
      fixedDelay ??
      Math.min(
        FIRST_RECONNECT_DELAY * Math.pow(1.5, this.reconnectAttempts - 1),
        MAX_RECONNECT_DELAY,
      );

    logger.info(
      `🔄 SubBot[${this.config.id}] reconectando en ${Math.round(delay / 1000)}s` +
        ` (intento ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
    );
    subBotDatabase.update(this.config.id, { status: 'connecting' });

    setTimeout(async () => {
      this.isReconnecting = false;
      if (!this.destroyed) {
        this.connectionEstablished = false;
        await this.closeCurrentSocket(); // garantiza que no haya socket viejo antes de reconectar
        void this.start();
      }
    }, delay);
  }

  // ─── Start ───────────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.destroyed) return;
    this.pairingCodeRequested = false;

    logger.info(
      `🌸 SubBot[${this.config.id}] starting (${this.config.name} | ${this.config.phoneNumber})`,
    );

    try {
      mkdirSync(this.config.sessionPath, { recursive: true });
      const { version } = await fetchLatestBaileysVersion();
      const { state, saveCreds } = await useEncryptedMultiFileAuthState(this.config.sessionPath);
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
        keepAliveIntervalMs: 15_000,
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
        saveCreds().catch((err: unknown) =>
          logError(`SubBotInstance[${this.config.id}].saveCreds`, err),
        );
        if (!this.connectionEstablished && this.sock?.authState?.creds?.registered) {
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

      this.sock.ev.on('group-participants.update', update => this.emit('groupUpdate', update));

      this.sock.ev.on('groups.update', updates => {
        for (const u of updates) {
          if (u.id) cacheManager.invalidateGroupMetadata(u.id);
        }
      });

      subBotDatabase.update(this.config.id, { status: 'connecting' });
      this.emit('status', 'connecting');

      // Solo pedir código si NO hay sesión existente
      if (!hasExistingCreds) {
        logger.info(`🔑 SubBot[${this.config.id}] nueva sesión, solicitando código en 8s...`);
        this.pairingCodeTimer = setTimeout(() => {
          if (!this.destroyed && this.sock && !this.sock.authState.creds.registered) {
            void this.requestPairingCode();
          }
        }, 8_000);
      } else {
        logger.info(`✅ SubBot[${this.config.id}] sesión existente, esperando reconexión...`);
      }
    } catch (error) {
      logError(`SubBot[${this.config.id}].start`, error);
      subBotDatabase.update(this.config.id, { status: 'error' });
      this.emit('status', 'error');
      this.scheduleReconnect();
    }
  }

  // ─── Manejador de conexión ───────────────────────────────────────────────────

  private async handleConnection(update: Partial<ConnectionState>): Promise<void> {
    const { connection, lastDisconnect } = update;

    const err = lastDisconnect?.error as
      | { output?: { statusCode?: number }; message?: string }
      | undefined;
    const statusCode = err?.output?.statusCode as number | undefined;

    if (statusCode !== undefined) {
      logger.warn(
        `🔍 SubBot[${this.config.id}] lastDisconnect: status=${statusCode} msg=${err?.message}`,
      );
    }

    // ── 440 Conflict ──────────────────────────────────────────────────────────
    // WA detectó dos conexiones del mismo número.
    // FIX: cerrar socket AHORA y esperar antes de reconectar.
    // Esto corta el loop: sin closeCurrentSocket() el socket viejo seguía
    // vivo y cada reconexión nueva generaba otro 440.
    if (statusCode === CONFLICT_CODE) {
      if (this.destroyed || this.isReconnecting) return;
      logger.warn(
        `⚡ SubBot[${this.config.id}] conflicto de sesión (440) — ` +
          `cerrando socket y esperando ${CONFLICT_RECONNECT_DELAY / 1000}s`,
      );
      this.stopPing();
      this.stopHealthCheck();
      this.connectionEstablished = false;
      await this.closeCurrentSocket();
      this.scheduleReconnect(CONFLICT_RECONNECT_DELAY);
      return;
    }

    // ── 401 loggedOut ─────────────────────────────────────────────────────────
    if (statusCode === DisconnectReason.loggedOut) {
      this.trueLogoutCount++;
      logger.warn(
        `⚠️ SubBot[${this.config.id}] loggedOut 401 (${this.trueLogoutCount}/${MAX_TRUE_LOGOUTS})`,
      );

      if (this.trueLogoutCount >= MAX_TRUE_LOGOUTS) {
        logger.error(`❌ SubBot[${this.config.id}] sesión revocada definitivamente`);
        this.clearSession();
        this.emit('sessionInvalid');
        return;
      }

      // Primer logout: puede ser transitorio
      setTimeout(() => {
        if (!this.destroyed) {
          this.connectionEstablished = false;
          void this.start();
        }
      }, 20_000);
      return;
    }

    // ── badSession (500) ──────────────────────────────────────────────────────
    if (statusCode === DisconnectReason.badSession) {
      logger.warn(`⚠️ SubBot[${this.config.id}] badSession — reconectando sin limpiar sesión`);
      if (connection === 'close') this.scheduleReconnect();
      return;
    }

    // ── Errores de red puros ──────────────────────────────────────────────────
    if (statusCode !== undefined && NETWORK_CODES.has(statusCode)) {
      logger.info(`🌐 SubBot[${this.config.id}] error de red (${statusCode})`);
      if (connection === 'close') this.scheduleReconnect();
      return;
    }

    // ── Estado de conexión ────────────────────────────────────────────────────

    if (connection === 'connecting') return;

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
      logger.warn(
        `⚠️ SubBot[${this.config.id}] connection closed (code: ${statusCode ?? 'unknown'})`,
      );
      if (this.destroyed || this.isReconnecting) return;

      if (!this.connectionEstablished) {
        subBotDatabase.update(this.config.id, { status: 'connecting' });
        setTimeout(() => {
          if (!this.destroyed && !this.isReconnecting) void this.start();
        }, 10_000);
        return;
      }

      this.scheduleReconnect();
    }
  }

  // ─── onFullyConnected ────────────────────────────────────────────────────────

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

    // 'ready' solo una vez por sesión vinculada.
    // Reconexiones automáticas (440, red caída, etc.) NO disparan este evento
    // y por tanto NO mandan mensajes al owner.
    if (!this.hasNotifiedReady) {
      this.hasNotifiedReady = true;
      this.emit('ready');
    }
  }

  // ─── Pairing code (solo sesiones nuevas) ─────────────────────────────────────

  private async requestPairingCode(): Promise<void> {
    if (!this.sock || this.destroyed) return;
    if (this.pairingCodeRequested) return;
    if (this.sock.authState.creds.registered) return;

    this.pairingCodeRequested = true;

    try {
      const phone = this.config.phoneNumber.replace(/\D/g, '');
      const code = await this.sock.requestPairingCode(phone);
      if (!code) throw new Error('WhatsApp did not return code');

      const formatted = code.match(/.{1,4}/g)?.join('-') ?? code;
      subBotDatabase.update(this.config.id, {
        pairingCode: formatted,
        pairingCodeRequestedAt: Date.now(),
      });

      logger.info(`🔑 SubBot[${this.config.id}] pairing code: ${formatted}`);
      this.emit('pairingCode', formatted);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`❌ SubBot[${this.config.id}] error requesting code: ${msg}`);
      this.pairingCodeRequested = false;

      if (msg.includes('Connection Closed') || msg.includes('imed out')) {
        if (!this.destroyed) {
          this.pairingCodeTimer = setTimeout(() => {
            if (!this.sock?.authState.creds.registered) void this.requestPairingCode();
          }, 5_000);
        }
      } else {
        logError(`SubBot[${this.config.id}].requestPairingCode`, error);
        this.emit('pairingCodeError', error);
      }
    }
  }

  // ─── Stop ────────────────────────────────────────────────────────────────────

  async stop(): Promise<void> {
    logger.info(`🛑 SubBot[${this.config.id}] stopping...`);
    this.destroyed = true;
    this.stopPing();
    this.stopHealthCheck();
    if (this.pairingCodeTimer) {
      clearTimeout(this.pairingCodeTimer);
      this.pairingCodeTimer = undefined;
    }
    await this.closeCurrentSocket();
    subBotDatabase.update(this.config.id, { status: 'disconnected' });
    this.emit('status', 'disconnected');
    logger.info(`✅ SubBot[${this.config.id}] stopped`);
  }

  clearSession(): void {
    logger.info(`🧹 SubBot[${this.config.id}] clearing session...`);
    this.hasNotifiedReady = false; // al re-vincular debe notificar de nuevo
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
