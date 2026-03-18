/**
 * AuthManager.ts
 *
 * Manages WhatsApp Web authentication using QR code or pairing code.
 * Handles connection lifecycle, reconnection logic, and session persistence.
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
import { config } from '@/config/index.js';
import { logger, logError } from '@/utils/logger.js';
import { displayQR, displayPairingCode, validatePhoneNumber } from '@/utils/qr.js';
import { unlinkSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const WA_BROWSER_PAIRING: [string, string, string] = ['Ubuntu', 'Chrome', '120.0.0'];
const WA_BROWSER_QR: [string, string, string] = ['VaniaBot', 'Chrome', '120.0.0'];
const SILENT_LOGGER = pino({ level: 'silent' });

const MAX_QR_RETRIES = 10;
const MAX_RECONNECT_ATTEMPTS = 15;
const CONNECTION_TIMEOUT = 120_000;
const RECONNECT_BASE_DELAY = 500;
const MAX_RECONNECT_DELAY = 5_000;
const PAIRING_CODE_TIMEOUT = 180_000;

const ERROR_515_MAX_RETRIES = 3;
const ERROR_515_WAIT_TIME = 3_000;

let _cachedVersion: [number, number, number] | null = null;

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ErrorWithStatus {
  output?: {
    statusCode?: number;
  };
  message?: string;
}

interface PatchedStdout extends NodeJS.WriteStream {
  __baileysPatch?: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────

async function getWAVersion(): Promise<[number, number, number]> {
  if (_cachedVersion) return _cachedVersion;

  try {
    const { version } = await fetchLatestBaileysVersion();
    _cachedVersion = version as [number, number, number];
    return _cachedVersion;
  } catch (error) {
    logger.warn('No se pudo obtener la última versión, usando fallback');
    console.error('Error:', error);
    _cachedVersion = [2, 3000, 1015901307];
    return _cachedVersion;
  }
}

function patchStdout(): void {
  const stdout = process.stdout as PatchedStdout;
  if (stdout.__baileysPatch) return;
  stdout.__baileysPatch = true;

  const _originalWrite = process.stdout.write.bind(process.stdout) as (
    chunk: string | Uint8Array,
    encoding?: BufferEncoding,
    callback?: (err?: Error | null) => void,
  ) => boolean;

  const CLOSING_RE = /^Closing session:/;

  (
    process.stdout as PatchedStdout & {
      write: (
        chunk: string | Uint8Array,
        encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
        cb?: (err?: Error | null) => void,
      ) => boolean;
    }
  ).write = function (
    chunk: string | Uint8Array,
    encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
    cb?: (err?: Error | null) => void,
  ): boolean {
    if (CLOSING_RE.test(chunk?.toString?.() ?? '')) {
      const callback = typeof encodingOrCb === 'function' ? encodingOrCb : cb;
      if (callback) callback();
      return true;
    }
    if (typeof encodingOrCb === 'function') {
      return _originalWrite(chunk, undefined, encodingOrCb);
    }
    return _originalWrite(chunk, encodingOrCb, cb);
  };
}

/**
 * Manages WhatsApp Web authentication and connection lifecycle.
 * Supports QR code and pairing code authentication with auto-reconnect.
 */
export class AuthManager {
  private pairingCodeRequested = false;
  private reconnectAttempts = 0;
  private connectionEstablished = false;
  private qrRetries = 0;
  private isConnecting = false;
  private lastDisconnectTime = 0;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private authPromise: Promise<void> | null = null;

  private error515Count = 0;
  private last515Time = 0;
  private badSessionCount = 0;
  private loggedOutCount = 0;

  constructor() {
    patchStdout();
  }

  async createSocket(): Promise<WASocket> {
    const timeSinceLastDisconnect = Date.now() - this.lastDisconnectTime;
    if (timeSinceLastDisconnect < 500 && this.reconnectAttempts > 0) {
      const delay = Math.min(RECONNECT_BASE_DELAY * this.reconnectAttempts, MAX_RECONNECT_DELAY);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const versionPromise = getWAVersion();
    mkdirSync(config.sessionPath, { recursive: true });

    const [version, { state, saveCreds }] = await Promise.all([
      versionPromise,
      useMultiFileAuthState(config.sessionPath),
    ]);

    const isRegistered = state.creds.registered;
    const credsMe = state.creds.me;

    logger.info(`WhatsApp Web v${version.join('.')}`);
    logger.info(isRegistered ? '✅ Sesión existente' : '🆕 Nueva sesión');

    if (isRegistered && credsMe) {
      logger.debug(
        {
          sessionId: credsMe.id,
          sessionName: credsMe.name,
        },
        '[Auth] Credenciales cargadas',
      );
    }

    const browser = config.auth.usePairingCode ? WA_BROWSER_PAIRING : WA_BROWSER_QR;

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, SILENT_LOGGER),
      },
      logger: SILENT_LOGGER,
      printQRInTerminal: false,
      browser,
      defaultQueryTimeoutMs: 60_000,
      connectTimeoutMs: CONNECTION_TIMEOUT,
      keepAliveIntervalMs: 20_000,
      getMessage: async () => undefined,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: false,
      retryRequestDelayMs: 150,
      shouldIgnoreJid: (jid: string) => jid?.endsWith('@broadcast'),
      emitOwnEvents: false,
      cachedGroupMetadata: async () => undefined,
      qrTimeout: 60_000,
    });

    sock.ev.on('creds.update', () => {
      saveCreds().catch(() => {});
    });

    sock.ev.on('connection.update', update =>
      this.handleConnection(sock, update).catch(err => logError('handleConnection', err)),
    );

    return sock;
  }

  private async handleConnection(sock: WASocket, update: Partial<ConnectionState>): Promise<void> {
    const { connection, lastDisconnect, qr, isNewLogin } = update;

    if (qr && !config.auth.usePairingCode) {
      const isRegistered = sock.authState.creds.registered;

      logger.debug(
        {
          qrReceived: true,
          isRegistered,
          isNewLogin,
          qrRetries: this.qrRetries,
        },
        '[Auth] Evento QR recibido',
      );

      if (isRegistered) {
        logger.info('🔄 Renovando sesión internamente (QR de refresh)');
        return;
      }

      this.qrRetries++;
      if (this.qrRetries > MAX_QR_RETRIES) {
        logger.error('❌ Demasiados QR sin escanear');
        this.clearSession();
        process.exit(1);
      }
      logger.info(`QR generado (${this.qrRetries}/${MAX_QR_RETRIES})`);
      displayQR(qr);

      if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
      this.connectionTimeout = setTimeout(() => {
        if (!this.connectionEstablished) {
          logger.warn('⚠️ Timeout esperando escaneo de QR');
        }
      }, 60_000);

      return;
    }

    if (
      config.auth.usePairingCode &&
      !this.pairingCodeRequested &&
      !sock.authState.creds.registered
    ) {
      this.pairingCodeRequested = true;
      if (!this.authPromise) {
        this.authPromise = this.requestPairingCode(sock);
      }
      return;
    }

    if (connection === 'connecting') {
      if (!this.isConnecting) {
        this.isConnecting = true;
        logger.info('🔌 Conectando...');
      }
      return;
    }

    if (connection === 'open') {
      await this.onConnectionOpen(sock);
      return;
    }

    if (connection === 'close') {
      this.lastDisconnectTime = Date.now();
      this.onConnectionClose(lastDisconnect);
    }
  }

  private async onConnectionOpen(sock: WASocket): Promise<void> {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    this.reconnectAttempts = 0;
    this.qrRetries = 0;
    this.isConnecting = false;
    this.pairingCodeRequested = false;
    this.authPromise = null;
    this.error515Count = 0;
    this.badSessionCount = 0;
    this.loggedOutCount = 0;

    if (!this.connectionEstablished) {
      this.connectionEstablished = true;
      logger.info('✅ Conectado a WhatsApp');

      if (sock.user) {
        logger.info(`${sock.user.name ?? 'Usuario'} | ${sock.user.id.split(':')[0]}`);
      }

      if (process.send) process.send('ready');
      logger.info('Bot operativo');
    }
  }

  private onConnectionClose(lastDisconnect: Partial<ConnectionState>['lastDisconnect']): void {
    this.isConnecting = false;

    const error = lastDisconnect?.error as ErrorWithStatus | undefined;
    const statusCode = error?.output?.statusCode;
    const reason = error?.message ?? 'Desconocido';

    logger.warn(`⚠️ Desconectado [${statusCode}]: ${reason}`);

    switch (statusCode) {
      case DisconnectReason.badSession:
        this.badSessionCount++;
        logger.warn(`⚠️ Sesión corrupta [${this.badSessionCount}/3] → reintentando`);
        if (this.badSessionCount >= 3) {
          logger.error('❌ Sesión corrupta persistente → limpiando');
          this.clearSession();
          this.connectionEstablished = false;
          this.badSessionCount = 0;
          process.exit(1);
        } else {
          this.scheduleReconnectFast();
        }
        break;

      case DisconnectReason.loggedOut:
        this.loggedOutCount++;
        logger.warn(
          `⚠️ Sesión cerrada desde el teléfono [${this.loggedOutCount}/3] → reintentando`,
        );
        if (this.loggedOutCount >= 3) {
          logger.error('❌ Sesión cerrada persistente → limpiando');
          this.clearSession();
          this.connectionEstablished = false;
          this.loggedOutCount = 0;
          process.exit(1);
        } else {
          this.scheduleReconnectFast();
        }
        break;

      case 515:
        this.handle515ErrorFast();
        break;

      case 408:
        if (config.auth.usePairingCode) {
          logger.error('❌ Timeout del código de pareamiento');
        } else {
          logger.error('❌ Timeout del código QR');
        }
        this.scheduleReconnectFast();
        break;

      case DisconnectReason.connectionReplaced:
        logger.warn('⚠️ Conexión reemplazada');
        process.exit(0);
        break;

      case DisconnectReason.connectionClosed:
      case DisconnectReason.connectionLost:
      case DisconnectReason.timedOut:
        this.scheduleReconnectFast();
        break;

      case DisconnectReason.restartRequired:
        logger.info('🔄 Reinicio requerido');
        setTimeout(() => process.exit(0), 500);
        break;

      default:
        this.scheduleReconnectDefault(statusCode);
        break;
    }
  }

  private handle515ErrorFast(): void {
    this.connectionEstablished = false;
    this.error515Count++;

    if (this.error515Count <= ERROR_515_MAX_RETRIES) {
      logger.warn(
        `⚠️ Error 515 [${this.error515Count}/${ERROR_515_MAX_RETRIES}] — reintentando en ${ERROR_515_WAIT_TIME / 1000}s`,
      );
      setTimeout(() => process.exit(0), ERROR_515_WAIT_TIME);
    } else {
      logger.error('❌ Error 515 persistente → limpiando sesión');
      this.clearSession();
      process.exit(1);
    }
  }

  private scheduleReconnectFast(): void {
    if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      logger.warn(`🔄 Reconexión [${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}]`);
      setTimeout(() => process.exit(0), 500);
    } else {
      logger.error('❌ Demasiados intentos fallidos');
      this.clearSession();
      process.exit(1);
    }
  }

  private scheduleReconnectDefault(statusCode: number | undefined): void {
    if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      logger.warn(`🔄 Error ${statusCode} [${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}]`);
      setTimeout(() => process.exit(0), 1_000);
    } else {
      logger.error(`❌ Error persistente: ${statusCode}`);
      this.clearSession();
      process.exit(1);
    }
  }

  private async requestPairingCode(sock: WASocket): Promise<void> {
    if (!config.auth.phoneNumber) {
      logger.error('❌ PHONE_NUMBER no configurado');
      process.exit(1);
    }

    try {
      const validatedPhone = validatePhoneNumber(config.auth.phoneNumber);
      const phone = validatedPhone.replace(/\D/g, '');

      logger.info(`📞 Solicitando código para: ${validatedPhone}`);

      const codePromise = sock.requestPairingCode(phone);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), PAIRING_CODE_TIMEOUT),
      );

      const code = await Promise.race([codePromise, timeoutPromise]);

      if (!code) {
        throw new Error('No se recibió código');
      }

      displayPairingCode(code);
      logger.info('Ingresa el código en WhatsApp');
    } catch (error: unknown) {
      this.pairingCodeRequested = false;
      this.authPromise = null;

      const msg = error instanceof Error ? error.message : String(error);

      if (
        msg.includes('Connection Closed') ||
        msg.includes('timed out') ||
        msg.includes('Timeout')
      ) {
        logger.warn('⚠️ Conexión cerrada — reintentando...');
        setTimeout(() => process.exit(0), 500);
      } else if (msg.includes('not registered')) {
        logger.error('❌ Número sin WhatsApp');
        process.exit(1);
      } else if (msg.includes('429') || msg.includes('rate')) {
        logger.error('❌ Demasiadas solicitudes');
        process.exit(1);
      } else {
        logError('requestPairingCode', error);
        process.exit(1);
      }
    }
  }

  private clearSession(): void {
    try {
      if (!existsSync(config.sessionPath)) return;

      const files = readdirSync(config.sessionPath);
      if (files.length === 0) return;

      logger.info(`Limpiando ${files.length} archivos...`);

      for (const file of files) {
        try {
          unlinkSync(join(config.sessionPath, file));
        } catch {
          // Ignorar errores individuales
        }
      }

      logger.info('✅ Sesión limpiada');
    } catch (error) {
      logError('clearSession', error);
    }
  }

  static showAuthMode(): void {
    const mode = config.auth.usePairingCode ? 'Código de pareamiento' : 'Código QR';
    logger.info(`Modo: ${mode}`);

    if (config.auth.usePairingCode && config.auth.phoneNumber) {
      logger.info(`Número: ${config.auth.phoneNumber}`);
    }
  }
}
