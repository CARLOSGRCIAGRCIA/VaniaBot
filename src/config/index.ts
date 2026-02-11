import { env } from "./env.js";
import type { BotConfig } from "@/types/index.js";

export const config: BotConfig = {
  name: env.BOT_NAME,
  prefix: env.PREFIX,
  owners: env.OWNERS,
  sessionPath: env.SESSION_PATH,
  auth: {
    usePairingCode: env.USE_PAIRING_CODE,
    phoneNumber: env.PHONE_NUMBER || undefined,
  },
  features: {
    antiSpam: true,
    autoRead: false,
    selfReply: false,
  },
  limits: {
    maxCommandsPerMinute: 10,
    maxMediaSize: 50 * 1024 * 1024,
  },
  database: {
    type: env.DB_TYPE,
    uri: env.DB_URI,
    path: "./data/database.json",
  },
};
