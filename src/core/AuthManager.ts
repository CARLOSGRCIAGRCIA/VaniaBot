import makeWASocket, {
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
  type ConnectionState,
} from "@whiskeysockets/baileys";
import pino from "pino";
import { config } from "@/config/index.js";
import { logger, logError } from "@/utils/logger.js";
import {
  displayQR,
  displayPairingCode,
  validatePhoneNumber,
} from "@/utils/qr.js";
import { unlinkSync, readdirSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const WA_BROWSER_PAIRING: [string, string, string] = [
  "Ubuntu",
  "Chrome",
  "120.0.0",
];
const WA_BROWSER_QR: [string, string, string] = [
  "VaniaBot",
  "Chrome",
  "120.0.0",
];
const SILENT_LOGGER = pino({ level: "silent" });

const MAX_QR_RETRIES = 10;
const MAX_RECONNECT_ATTEMPTS = 15;
const CONNECTION_TIMEOUT = 120_000;
const RECONNECT_BASE_DELAY = 500;
const MAX_RECONNECT_DELAY = 5_000;
const PAIRING_CODE_TIMEOUT = 180_000;

const ERROR_515_MAX_RETRIES = 3;
const ERROR_515_WAIT_TIME = 3_000;

let _cachedVersion: [number, number, number] | null = null;

async function getWAVersion(): Promise<[number, number, number]> {
  if (_cachedVersion) return _cachedVersion;

  try {
    const { version } = await fetchLatestBaileysVersion();
    _cachedVersion = version as [number, number, number];
    return _cachedVersion;
  } catch (error) {
    logger.warn("No se pudo obtener la última versión, usando fallback");
    _cachedVersion = [2, 3000, 1015901307];
    return _cachedVersion;
  }
}

function patchStdout(): void {
  if ((process.stdout as any).__baileysPatch) return;
  (process.stdout as any).__baileysPatch = true;

  const _originalWrite = process.stdout.write.bind(process.stdout);
  const CLOSING_RE = /^Closing session:/;

  (process.stdout as any).write = function (
    chunk: string | Buffer,
    encOrCb?: any,
    cb?: any,
  ): boolean {
    if (CLOSING_RE.test(chunk?.toString?.() ?? "")) {
      const callback = typeof encOrCb === "function" ? encOrCb : cb;
      if (callback) callback();
      return true;
    }
    return _originalWrite(chunk, encOrCb, cb);
  };
}

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

  constructor() {
    patchStdout();
  }

  async createSocket(): Promise<WASocket> {
    const timeSinceLastDisconnect = Date.now() - this.lastDisconnectTime;
    if (timeSinceLastDisconnect < 500 && this.reconnectAttempts > 0) {
      const delay = Math.min(
        RECONNECT_BASE_DELAY * this.reconnectAttempts,
        MAX_RECONNECT_DELAY,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const versionPromise = getWAVersion();
    mkdirSync(config.sessionPath, { recursive: true });

    const [version, { state, saveCreds }] = await Promise.all([
      versionPromise,
      useMultiFileAuthState(config.sessionPath),
    ]);

    logger.info(`📱 WhatsApp Web v${version.join(".")}`);
    logger.info(
      state.creds.registered ? " Sesión existente" : "🆕 Nueva sesión",
    );

    const browser = config.auth.usePairingCode
      ? WA_BROWSER_PAIRING
      : WA_BROWSER_QR;

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
      shouldIgnoreJid: (jid: string) => jid?.endsWith("@broadcast"),
      emitOwnEvents: false,
      cachedGroupMetadata: async () => undefined,
      qrTimeout: 60_000,
    });

    sock.ev.on("creds.update", () => {
      saveCreds().catch(() => {});
    });

    sock.ev.on("connection.update", (update) =>
      this.handleConnection(sock, update).catch((err) =>
        logError("handleConnection", err),
      ),
    );

    return sock;
  }

  private async handleConnection(
    sock: WASocket,
    update: Partial<ConnectionState>,
  ): Promise<void> {
    const { connection, lastDisconnect, qr, isNewLogin } = update;

    if (qr && !config.auth.usePairingCode) {
      this.qrRetries++;
      if (this.qrRetries > MAX_QR_RETRIES) {
        logger.error("❌ Demasiados QR sin escanear");
        this.clearSession();
        process.exit(1);
      }
      logger.info(`📱 QR generado (${this.qrRetries}/${MAX_QR_RETRIES})`);
      displayQR(qr);

      if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
      this.connectionTimeout = setTimeout(() => {
        if (!this.connectionEstablished) {
          logger.warn("⚠️ Timeout esperando escaneo de QR");
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

    if (connection === "connecting") {
      if (!this.isConnecting) {
        this.isConnecting = true;
        logger.info("🔌 Conectando...");
      }
      return;
    }

    if (connection === "open") {
      await this.onConnectionOpen(sock);
      return;
    }

    if (connection === "close") {
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

    if (!this.connectionEstablished) {
      this.connectionEstablished = true;
      logger.info(" Conectado a WhatsApp");

      if (sock.user) {
        logger.info(
          `👤 ${sock.user.name ?? "Usuario"} | 📱 ${sock.user.id.split(":")[0]}`,
        );
      }

      if (process.send) process.send("ready");
      logger.info("🤖 Bot operativo");
    }
  }

  private onConnectionClose(
    lastDisconnect: Partial<ConnectionState>["lastDisconnect"],
  ): void {
    this.isConnecting = false;

    const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
    const reason = lastDisconnect?.error?.message ?? "Desconocido";

    logger.warn(`⚠️ Desconectado [${statusCode}]: ${reason}`);

    switch (statusCode) {
      case DisconnectReason.badSession:
        logger.error("❌ Sesión corrupta → limpiando");
        this.clearSession();
        this.connectionEstablished = false;
        process.exit(1);
        break;

      case DisconnectReason.loggedOut:
        logger.error("❌ Sesión cerrada desde el teléfono → limpiando");
        this.clearSession();
        this.connectionEstablished = false;
        process.exit(1);
        break;

      case 515:
        this.handle515ErrorFast();
        break;

      case 408:
        if (config.auth.usePairingCode) {
          logger.error("❌ Timeout del código de pareamiento");
        } else {
          logger.error("❌ Timeout del código QR");
        }
        this.scheduleReconnectFast(statusCode);
        break;

      case DisconnectReason.connectionReplaced:
        logger.warn("⚠️ Conexión reemplazada");
        process.exit(0);
        break;

      case DisconnectReason.connectionClosed:
      case DisconnectReason.connectionLost:
      case DisconnectReason.timedOut:
        this.scheduleReconnectFast(statusCode);
        break;

      case DisconnectReason.restartRequired:
        logger.info("🔄 Reinicio requerido");
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
      logger.error("❌ Error 515 persistente → limpiando sesión");
      this.clearSession();
      process.exit(1);
    }
  }

  private scheduleReconnectFast(statusCode: number): void {
    if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      logger.warn(
        `🔄 Reconexión [${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}]`,
      );
      setTimeout(() => process.exit(0), 500);
    } else {
      logger.error("❌ Demasiados intentos fallidos");
      this.clearSession();
      process.exit(1);
    }
  }

  private scheduleReconnectDefault(statusCode: number): void {
    if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      logger.warn(
        `🔄 Error ${statusCode} [${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}]`,
      );
      setTimeout(() => process.exit(0), 1_000);
    } else {
      logger.error(`❌ Error persistente: ${statusCode}`);
      this.clearSession();
      process.exit(1);
    }
  }

  private async requestPairingCode(sock: WASocket): Promise<void> {
    if (!config.auth.phoneNumber) {
      logger.error("❌ PHONE_NUMBER no configurado");
      process.exit(1);
    }

    try {
      const validatedPhone = validatePhoneNumber(config.auth.phoneNumber);
      const phone = validatedPhone.replace(/\D/g, "");

      logger.info(`📞 Solicitando código para: ${validatedPhone}`);

      const codePromise = sock.requestPairingCode(phone);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), PAIRING_CODE_TIMEOUT),
      );

      const code = await Promise.race([codePromise, timeoutPromise]);

      if (!code) {
        throw new Error("No se recibió código");
      }

      displayPairingCode(code);
      logger.info("📱 Ingresa el código en WhatsApp");
    } catch (error: any) {
      this.pairingCodeRequested = false;
      this.authPromise = null;

      const msg = error?.message ?? String(error);

      if (
        msg.includes("Connection Closed") ||
        msg.includes("timed out") ||
        msg.includes("Timeout")
      ) {
        logger.warn("⚠️ Conexión cerrada — reintentando...");
        setTimeout(() => process.exit(0), 500);
      } else if (msg.includes("not registered")) {
        logger.error("❌ Número sin WhatsApp");
        process.exit(1);
      } else if (msg.includes("429") || msg.includes("rate")) {
        logger.error("❌ Demasiadas solicitudes");
        process.exit(1);
      } else {
        logError("requestPairingCode", error);
        process.exit(1);
      }
    }
  }

  private clearSession(): void {
    try {
      if (!existsSync(config.sessionPath)) return;

      const files = readdirSync(config.sessionPath);
      if (files.length === 0) return;

      logger.info(`🧹 Limpiando ${files.length} archivos...`);

      for (const file of files) {
        try {
          unlinkSync(join(config.sessionPath, file));
        } catch (_) {}
      }

      logger.info(" Sesión limpiada");
    } catch (error) {
      logError("clearSession", error);
    }
  }

  static showAuthMode(): void {
    const mode = config.auth.usePairingCode
      ? "Código de pareamiento"
      : "Código QR";
    logger.info(`🔐 Modo: ${mode}`);

    if (config.auth.usePairingCode && config.auth.phoneNumber) {
      logger.info(`📱 Número: ${config.auth.phoneNumber}`);
    }
  }
}
