/**
 * WatchdogService.ts
 *
 * Multi-factor health monitoring for bots.
 * Monitors connection, heartbeat, message processing, errors, and memory.
 *
 * @author Carlos G
 * @created 2026-04-07
 */

import { logger, logError } from '@/utils/logger.js';
import { runtimeStateRepository } from '@/repositories/RuntimeStateRepository.js';

export type BotHealthStatus =
  | 'healthy'
  | 'degraded'
  | 'connecting'
  | 'disconnected'
  | 'quarantined'
  | 'error';

export interface HealthReport {
  botId: string;
  status: BotHealthStatus;
  lastHeartbeat: Date | null;
  lastMessageProcessed: Date | null;
  connectionState: string;
  errorCount: number;
  messageCount: number;
  isConnected: boolean;
  isQuarantined: boolean;
  details: string[];
}

export interface WatchdogConfig {
  heartbeatThresholdMs: number;
  messageProcessingThresholdMs: number;
  maxErrorsBeforeQuarantine: number;
  quarantineCooldownMs: number;
}

const DEFAULT_CONFIG: WatchdogConfig = {
  heartbeatThresholdMs: 120000,
  messageProcessingThresholdMs: 300000,
  maxErrorsBeforeQuarantine: 5,
  quarantineCooldownMs: 300000,
};

export class WatchdogService {
  private static instance: WatchdogService;
  private config: WatchdogConfig;
  private reports = new Map<string, HealthReport>();

  private constructor(config: Partial<WatchdogConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  static getInstance(config?: Partial<WatchdogConfig>): WatchdogService {
    if (!WatchdogService.instance) {
      WatchdogService.instance = new WatchdogService(config);
    }
    return WatchdogService.instance;
  }

  checkHealth(botId: string): HealthReport {
    const state = runtimeStateRepository.findByBotId(botId);

    if (!state) {
      return {
        botId,
        status: 'disconnected',
        lastHeartbeat: null,
        lastMessageProcessed: null,
        connectionState: 'unknown',
        errorCount: 0,
        messageCount: 0,
        isConnected: false,
        isQuarantined: false,
        details: ['Bot not found in runtime state'],
      };
    }

    const details: string[] = [];
    let status: BotHealthStatus = 'healthy';
    const now = Date.now();

    const isQuarantined = runtimeStateRepository.isQuarantined(botId);
    if (isQuarantined) {
      status = 'quarantined';
      details.push('Bot is quarantined');
    }

    const isConnected = state.is_connected === 1;
    if (!isConnected && state.connection_state === 'connecting') {
      status = 'connecting';
      details.push('Bot is connecting');
    } else if (!isConnected) {
      status = 'disconnected';
      details.push('Bot is disconnected');
    }

    const lastHeartbeat = state.last_heartbeat ? new Date(state.last_heartbeat).getTime() : null;
    if (lastHeartbeat && now - lastHeartbeat > this.config.heartbeatThresholdMs) {
      if (status === 'healthy') status = 'degraded';
      details.push('Stale heartbeat');
    }

    const lastMessageProcessed = state.last_message_processed_at
      ? new Date(state.last_message_processed_at).getTime()
      : null;
    if (
      lastMessageProcessed &&
      now - lastMessageProcessed > this.config.messageProcessingThresholdMs
    ) {
      if (status === 'healthy') status = 'degraded';
      details.push('No messages processed recently');
    }

    const errorCount = state.error_count_total ?? 0;
    if (errorCount > this.config.maxErrorsBeforeQuarantine) {
      status = 'error';
      details.push(`High error count: ${errorCount}`);
    }

    const report: HealthReport = {
      botId,
      status,
      lastHeartbeat: lastHeartbeat ? new Date(lastHeartbeat) : null,
      lastMessageProcessed: lastMessageProcessed ? new Date(lastMessageProcessed) : null,
      connectionState: state.connection_state ?? 'unknown',
      errorCount,
      messageCount: state.messages_total ?? 0,
      isConnected,
      isQuarantined,
      details,
    };

    this.reports.set(botId, report);
    return report;
  }

  checkAllHealth(): HealthReport[] {
    const allBots = runtimeStateRepository.findAll();
    return allBots.map(bot => this.checkHealth(bot.bot_id));
  }

  getHealth(botId: string): HealthReport | null {
    return this.reports.get(botId) ?? null;
  }

  getAllHealth(): HealthReport[] {
    return Array.from(this.reports.values());
  }

  shouldQuarantine(botId: string): boolean {
    const report = this.checkHealth(botId);
    return (
      report.status === 'error' ||
      (report.errorCount >= this.config.maxErrorsBeforeQuarantine && !report.isQuarantined)
    );
  }

  quarantineBot(botId: string, reason: string): void {
    runtimeStateRepository.setQuarantined(botId, this.config.quarantineCooldownMs, reason);
    logger.warn(`[Watchdog] Bot ${botId} quarantined: ${reason}`);
  }

  releaseFromQuarantine(botId: string): void {
    runtimeStateRepository.releaseFromQuarantine(botId);
    logger.info(`[Watchdog] Bot ${botId} released from quarantine`);
  }
}

export const watchdogService = WatchdogService.getInstance();
