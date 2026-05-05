/**
 * OrchestratorService.ts
 *
 * Central orchestrator for multi-bot system.
 * Manages lifecycle of all bot services.
 *
 * @author Carlos G
 * @created 2026-04-07
 */

import { logger, logError } from '@/utils/logger.js';
import { runtimeStateRepository } from '@/repositories/RuntimeStateRepository.js';
import { getDatabase } from '@/repositories/Database.js';

export interface OrchestratorConfig {
  enableWatchdog: boolean;
  enableRecovery: boolean;
  enableHeartbeat: boolean;
  healthCheckIntervalMs: number;
  reconnectTimeoutMs: number;
  maxReconnectAttempts: number;
}

export interface OrchestratorStatus {
  isRunning: boolean;
  lastHealthCheck: Date | null;
  activeBots: number;
  bots: string[];
}

export class OrchestratorService {
  private static instance: OrchestratorService;
  private config: OrchestratorConfig;
  private isRunning = false;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private activeBotIds: Set<string> = new Set();

  private constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = {
      enableWatchdog: config.enableWatchdog ?? true,
      enableRecovery: config.enableRecovery ?? true,
      enableHeartbeat: config.enableHeartbeat ?? true,
      healthCheckIntervalMs: config.healthCheckIntervalMs ?? 60000,
      reconnectTimeoutMs: config.reconnectTimeoutMs ?? 300000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
    };
  }

  static getInstance(config?: Partial<OrchestratorConfig>): OrchestratorService {
    if (!OrchestratorService.instance) {
      OrchestratorService.instance = new OrchestratorService(config);
    }
    return OrchestratorService.instance;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.debug('[Orchestrator] Already running');
      return;
    }

    logger.info('[Orchestrator] Starting...');

    try {
      if (!getDatabase().isInitialized()) {
        throw new Error('Database not initialized');
      }

      this.loadActiveBots();
      this.startHealthCheck();

      this.isRunning = true;
      logger.info(`✅ Orchestrator started with ${this.activeBotIds.size} active bots`);
    } catch (error) {
      logError('[Orchestrator] Start failed', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('[Orchestrator] Stopping...');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    this.isRunning = false;
    logger.info('✅ Orchestrator stopped');
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  private loadActiveBots(): void {
    const connectedBots = runtimeStateRepository.findConnected();
    this.activeBotIds.clear();

    for (const bot of connectedBots) {
      this.activeBotIds.add(bot.bot_id);
    }

    logger.debug(`[Orchestrator] Loaded ${this.activeBotIds.size} active bots`);
  }

  private startHealthCheck(): void {
    if (!this.config.enableWatchdog) return;

    this.healthCheckInterval = setInterval(() => {
      void this.performHealthCheck();
    }, this.config.healthCheckIntervalMs);
  }

  private async performHealthCheck(): Promise<void> {
    try {
      this.loadActiveBots();

      const _connectedBots = runtimeStateRepository.findConnected();
      const staleBots = runtimeStateRepository.findStaleHeartbeat(120000);

      for (const bot of staleBots) {
        logger.warn(`[Orchestrator] Bot ${bot.bot_id} has stale heartbeat`);
        runtimeStateRepository.updateConnection(bot.bot_id, 0, 'stale_heartbeat');
        this.activeBotIds.delete(bot.bot_id);
      }

      if (this.config.enableRecovery && staleBots.length > 0) {
        logger.info(`[Orchestrator] Triggering recovery for ${staleBots.length} stale bots`);
      }
    } catch (error) {
      logError('[Orchestrator] Health check failed', error);
    }
  }

  registerBot(botId: string): void {
    this.activeBotIds.add(botId);
    logger.debug(`[Orchestrator] Registered bot: ${botId}`);
  }

  unregisterBot(botId: string): void {
    this.activeBotIds.delete(botId);
    logger.debug(`[Orchestrator] Unregistered bot: ${botId}`);
  }

  getStatus(): OrchestratorStatus {
    return {
      isRunning: this.isRunning,
      lastHealthCheck: this.isRunning ? new Date() : null,
      activeBots: this.activeBotIds.size,
      bots: Array.from(this.activeBotIds),
    };
  }

  getActiveBotIds(): string[] {
    return Array.from(this.activeBotIds);
  }
}

export const orchestratorService = OrchestratorService.getInstance();
