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
const MAX_QR_RETRIES = 3;
const MAX_RECONNECT_ATTEMPTS = 5;

let _cachedVersion: [number, number, number] | null = null;

async function getWAVersion(): Promise<[number, number, number]> {
  if (_cachedVersion) return _cachedVersion;
  const { version } = await fetchLatestBaileysVersion();
  _cachedVersion = version as [number, number, number];
  return _cachedVersion;
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

  constructor() {
    patchStdout();
  }

  async createSocket(): Promise<WASocket> {
    const timeSinceLastDisconnect = Date.now() - this.lastDisconnectTime;
    if (timeSinceLastDisconnect < 2000 && this.reconnectAttempts > 0) {
      const delay = Math.min(3_000 * this.reconnectAttempts, 15_000);
      logger.info(`⏳ Reconectando en ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const version = await getWAVersion();
    logger.info(`📱 WhatsApp Web v${version.join(".")}`);

    mkdirSync(config.sessionPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(
      config.sessionPath,
    );

    logger.info(
      state.creds.registered ? "✅ Sesión existente" : "🆕 Nueva sesión",
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
      defaultQueryTimeoutMs: undefined,
      connectTimeoutMs: 60_000,
      keepAliveIntervalMs: 30_000,
      getMessage: async () => undefined,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      retryRequestDelayMs: 250,
      shouldIgnoreJid: (jid: string) => jid?.endsWith("@broadcast"),
      emitOwnEvents: false,
    });

    sock.ev.on("creds.update", saveCreds);
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
      return;
    }

    if (
      config.auth.usePairingCode &&
      !this.pairingCodeRequested &&
      !sock.authState.creds.registered
    ) {
      this.pairingCodeRequested = true;

      await new Promise((resolve) => setTimeout(resolve, 1000));

      await this.requestPairingCode(sock);
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
    this.reconnectAttempts = 0;
    this.qrRetries = 0;
    this.isConnecting = false;
    _cachedVersion = null;

    if (!this.connectionEstablished) {
      this.connectionEstablished = true;
      logger.info("✅ Conectado a WhatsApp");

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

    logger.warn(`⚠️  Desconectado [${statusCode}]: ${reason}`);

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
        this.handle515Error();
        break;

      case 408:
        if (config.auth.usePairingCode) {
          logger.error("❌ Timeout del código de pareamiento");
          logger.info(
            "💡 Asegúrate de ingresar el código en tu teléfono dentro de 1-2 minutos",
          );
        } else {
          logger.error("❌ Timeout del código QR");
        }
        this.clearSession();
        process.exit(1);
        break;

      case DisconnectReason.connectionReplaced:
        logger.warn("⚠️  Conexión reemplazada por otra sesión activa");
        process.exit(0);
        break;

      case DisconnectReason.connectionClosed:
      case DisconnectReason.connectionLost:
      case DisconnectReason.timedOut:
        this.scheduleReconnect(statusCode);
        break;

      case DisconnectReason.restartRequired:
        logger.info("🔄 Reinicio requerido por WhatsApp...");
        setTimeout(() => process.exit(0), 1_000);
        break;

      default:
        this.scheduleReconnectDefault(statusCode);
        break;
    }
  }

  private handle515Error(): void {
    this.connectionEstablished = false;
    this.reconnectAttempts++;

    if (this.reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
      const waitSec = 15 * this.reconnectAttempts;
      logger.warn(
        `⚠️  Error 515 [${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}] — esperando ${waitSec}s`,
      );
      setTimeout(() => process.exit(0), waitSec * 1_000);
    } else {
      logger.error(
        "❌ Error 515 persistente — cierra todas las sesiones de WhatsApp Web y espera 2 min",
      );
      this.clearSession();
      process.exit(1);
    }
  }

  private scheduleReconnect(statusCode: number): void {
    if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      logger.warn(
        `🔄 Reconexión [${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}] por código ${statusCode}`,
      );
      setTimeout(() => process.exit(0), 2_000);
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
      setTimeout(() => process.exit(0), 3_000);
    } else {
      logger.error(`❌ Error persistente: ${statusCode}`);
      this.clearSession();
      process.exit(1);
    }
  }

  private async requestPairingCode(sock: WASocket): Promise<void> {
    if (!config.auth.phoneNumber) {
      logger.error("❌ PHONE_NUMBER no configurado en .env");
      process.exit(1);
    }

    try {
      const validatedPhone = validatePhoneNumber(config.auth.phoneNumber);
      const phone = validatedPhone.replace(/\D/g, "");

      logger.info(`📞 Solicitando código para: ${validatedPhone}`);

      const code = await sock.requestPairingCode(phone);

      if (!code) {
        throw new Error("No se recibió código de pareamiento");
      }

      displayPairingCode(code);
      logger.info(
        "📱 WhatsApp → Dispositivos vinculados → Vincular con número de teléfono",
      );
      logger.info("⏳ Esperando que ingreses el código en WhatsApp...");
    } catch (error: any) {
      this.pairingCodeRequested = false;
      const msg = error?.message ?? String(error);

      if (msg.includes("Connection Closed") || msg.includes("timed out")) {
        logger.warn(
          "⚠️  Conexión cerrada al solicitar código — reintentando...",
        );
        setTimeout(() => process.exit(0), 1_500);
      } else if (msg.includes("not registered")) {
        logger.error("❌ Este número no tiene WhatsApp activo");
        logger.error(`   Número verificado: ${config.auth.phoneNumber}`);
        process.exit(1);
      } else if (msg.includes("429") || msg.includes("rate")) {
        logger.error(
          "❌ Demasiadas solicitudes — espera 5-10 minutos e intenta de nuevo",
        );
        process.exit(1);
      } else {
        logError("requestPairingCode", error);
        logger.error("💡 Verifica que el número sea correcto");
        logger.error(`   Formato correcto: +529514639799 o 529514639799`);
        process.exit(1);
      }
    }
  }

  private clearSession(): void {
    try {
      if (!existsSync(config.sessionPath)) return;

      const files = readdirSync(config.sessionPath);
      if (files.length === 0) return;

      logger.info(`🧹 Limpiando ${files.length} archivos de sesión...`);

      for (const file of files) {
        try {
          unlinkSync(join(config.sessionPath, file));
        } catch (_) {}
      }

      logger.info("✅ Sesión limpiada");
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
