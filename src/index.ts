import { WhatsAppClient } from './core/Client.js';
import { logger, logError } from './utils/logger.js';

const originalConsoleError = console.error;
console.error = function (...args: unknown[]) {
  const msg = args[0];
  if (
    typeof msg === 'string' &&
    (msg.includes('Bad MAC') || msg.includes('Failed to decrypt') || msg.includes('Session error'))
  ) {
    return;
  }
  originalConsoleError.apply(console, args);
};

let client: WhatsAppClient;

async function main(): Promise<void> {
  logger.info('Iniciando WhatsApp Bot...');
  client = new WhatsAppClient();
  global.client = client;
  await client.initialize();
  logger.info('Bot iniciado correctamente');
}

async function shutdown(reason: string): Promise<void> {
  logger.info(`Deteniendo bot (${reason})...`);
  if (client) {
    await client.shutdown();
  }
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('uncaughtException', error => {
  logError('Uncaught Exception', error);
  process.exit(1);
});

process.on('unhandledRejection', reason => {
  logError('Unhandled Rejection', reason);
  process.exit(1);
});

main().catch(error => {
  logError('main', error);
  process.exit(1);
});
