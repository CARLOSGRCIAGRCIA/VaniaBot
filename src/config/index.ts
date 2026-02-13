import { env } from "./env.js";
import type { BotConfig } from "@/types/index.js";

export const config: BotConfig = {
  name: env.BOT_NAME,
  prefix: env.PREFIX,
  owners: env.OWNERS,
  ownerJids: env.OWNER_JIDS || [],
  sessionPath: env.SESSION_PATH,
  auth: {
    usePairingCode: env.USE_PAIRING_CODE,
    phoneNumber: env.PHONE_NUMBER,
  },
  features: {
    antiSpam: env.ANTI_SPAM,
    autoRead: false,
    selfReply: false,
    cacheEnabled: env.CACHE_ENABLED,
    autoReconnect: env.AUTO_RECONNECT,
  },
  limits: {
    maxCommandsPerMinute: 10,
    maxMediaSize: 50 * 1024 * 1024,
    maxReconnectAttempts: env.MAX_RECONNECT_ATTEMPTS,
  },
  database: {
    type: env.DB_TYPE,
    uri: env.DB_URI,
    path: "./data/database.json",
  },
};
