import { WhatsAppClient } from "./core/Client.js";
import { logger, logError } from "./utils/logger.js";

let client: WhatsAppClient;

async function main(): Promise<void> {
  logger.info("Iniciando WhatsApp Bot...");
  client = new WhatsAppClient();
  await client.initialize();
  logger.info("Bot iniciado correctamente");
}

async function shutdown(reason: string): Promise<void> {
  logger.info(`Deteniendo bot (${reason})...`);
  if (client) {
    await client.shutdown();
  }
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("uncaughtException", (error) => {
  logError("Uncaught Exception", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logError("Unhandled Rejection", reason);
  process.exit(1);
});

main().catch((error) => {
  logError("main", error);
  process.exit(1);
});
