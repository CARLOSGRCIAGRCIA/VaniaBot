import { WhatsAppClient } from './core/Client.js';
import { logger, logError } from './utils/logger.js';
import { panelServer } from './services/webhook/PanelServer.js';
import { initializeDatabase } from './repositories/Database.js';
import { subBotDatabase } from './services/subbot/SubBotDatabase.js';
import { databaseSwitcher } from './services/system/DatabaseSwitcher.js';

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

  try {
    logger.info('Inicializando sistema de base de datos...');
    await databaseSwitcher.initialize();
    await initializeDatabase();
    await subBotDatabase.initialize();
    logger.info('✅ Base de datos inicializada');
  } catch (error) {
    logger.warn('⚠️ Error inicializando base de datos, continuando sin ella:', error);
  }

  client = new WhatsAppClient();
  await client.initialize();
  logger.info('Bot iniciado correctamente');

  const disablePanel = process.env.PANEL_DISABLED === 'true';
  if (!disablePanel) {
    await panelServer.start();
  }
}

async function shutdown(reason: string): Promise<void> {
  logger.info(`Deteniendo bot (${reason})...`);
  try {
    if (client) {
      await client.shutdown();
    }
    await panelServer.stop();
    await logger.flush();
  } catch (error) {
    logError('shutdown', error);
  }

  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGINT', () => {
  shutdown('SIGINT').catch(err => logError('SIGINT handler', err));
});
process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch(err => logError('SIGTERM handler', err));
});

process.on('uncaughtException', error => {
  logError('Uncaught Exception', error);
});

process.on('unhandledRejection', reason => {
  logError('Unhandled Rejection', reason);
});

main().catch(error => {
  logError('main', error);
});
