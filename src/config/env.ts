import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  BOT_NAME: z.string().default("VaniaBot"),
  PREFIX: z.string().default("!"),
  OWNERS: z.string().transform((val) => val.split(",").filter(Boolean)),
  SESSION_PATH: z.string().default("./data/vaniasession"),
  USE_PAIRING_CODE: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  PHONE_NUMBER: z.string().optional(),
  DB_TYPE: z.enum(["json", "mongodb"]).default("json"),
  DB_URI: z.string().optional(),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
});

export const env = envSchema.parse(process.env);
