import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  BOT_NAME: z.string().default("VaniaBot"),
  PREFIX: z.string().default("!"),
  OWNERS: z
    .string()
    .default("208924405956643@lid,208924405956643,529516526675")
    .transform((val) => val.split(",").filter(Boolean)),
  OWNER_JIDS: z
    .string()
    .optional()
    .default("208924405956643@lid")
    .transform((val) => (val ? val.split(",").filter(Boolean) : [])),
  SESSION_PATH: z.string().default("./data/vaniasession"),
  USE_PAIRING_CODE: z
    .string()
    .transform((val) => val === "true")
    .default("true"),
  PHONE_NUMBER: z.string().default("+529514639799"),
  DB_TYPE: z.enum(["json", "mongodb"]).default("json"),
  DB_URI: z.string().optional(),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  MAX_RECONNECT_ATTEMPTS: z
    .string()
    .transform((val) => parseInt(val))
    .default("50"),
  AUTO_RECONNECT: z
    .string()
    .transform((val) => val === "true")
    .default("true"),
  CACHE_ENABLED: z
    .string()
    .transform((val) => val === "true")
    .default("true"),
  ANTI_SPAM: z
    .string()
    .transform((val) => val === "true")
    .default("true"),
});

export const env = envSchema.parse(process.env);
