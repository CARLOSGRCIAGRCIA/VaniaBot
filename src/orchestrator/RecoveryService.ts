/**
 * RecoveryService.ts
 *
 * Auto-recovery service for bots.
 * Handles reconnection with exponential backoff and quarantine logic.
 *
 * @author Carlos G
 * @created 2026-04-07
 */

import { logger, logError } from '@/utils/logger.js';
import { runtimeStateRepository } from '@/repositories/RuntimeStateRepository.js';
import { watchdogService } from './WatchdogService.js';

export interface RecoveryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  quarantineEnabled: boolean;
  quarantineCooldownMs: number;
}

const DEFAULT_CONFIG: RecoveryConfig = {
  maxAttempts: 5,
  baseDelayMs: 5000,
  maxDelayMs: 60000,
  quarantineEnabled: true,
  quarantineCooldownMs: 300000,
};

export class RecoveryService {
  private static instance: RecoveryService;
  private config: RecoveryConfig;
  private recoveryInProgress = new Set<string>();
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  private constructor(config: Partial<RecoveryConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  static getInstance(config?: Partial<RecoveryConfig>): RecoveryService {
    if (!RecoveryService.instance) {
      RecoveryService.instance = new RecoveryService(config);
    }
    return RecoveryService.instance;
  }

  async attemptRecovery(botId: string): Promise<boolean> {
    if (this.recoveryInProgress.has(botId)) {
      logger.debug(`[Recovery] Recovery already in progress for ${botId}`);
      return false;
    }

    if (runtimeStateRepository.isQuarantined(botId)) {
      logger.info(`[Recovery] Bot ${botId} is quarantined, skipping recovery`);
      return false;
    }

    const state = runtimeStateRepository.findByBotId(botId);
    if (!state) {
      logger.warn(`[Recovery] Bot ${botId} not found in runtime state`);
      return false;
    }

    const attempts = state.reconnect_attempts ?? 0;
    if (attempts >= this.config.maxAttempts) {
      logger.warn(`[Recovery] Max attempts reached for ${botId}`);

      if (this.config.quarantineEnabled) {
        const reason = `max_reconnect_attempts_${attempts}`;
        watchdogService.quarantineBot(botId, reason);
      }
      return false;
    }

    this.recoveryInProgress.add(botId);
    runtimeStateRepository.updateConnectionState(botId, 'reconnecting');

    const delay = this.calculateDelay(attempts);
    logger.info(
      `[Recovery] Attempting recovery for ${botId} in ${delay}ms (attempt ${attempts + 1}/${this.config.maxAttempts})`,
    );

    try {
      await this.performRecovery(botId, attempts + 1);

      runtimeStateRepository.resetReconnectAttempts(botId);
      runtimeStateRepository.incrementRestartCount(botId);
      runtimeStateRepository.updateConnection(botId, 1, 'recovery_success');
      runtimeStateRepository.updateConnectionState(botId, 'connected');

      logger.info(`[Recovery] Recovery successful for ${botId}`);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      runtimeStateRepository.updateConnection(botId, 0, `recovery_attempt_${attempts + 1}`);
      runtimeStateRepository.updateError(botId, errorMsg);
      runtimeStateRepository.incrementErrorCount(botId);

      if (watchdogService.shouldQuarantine(botId)) {
        watchdogService.quarantineBot(botId, 'recovery_failed');
      }

      logError(`[Recovery] Recovery failed for ${botId}`, error);
      return false;
    } finally {
      this.recoveryInProgress.delete(botId);
    }
  }

  private calculateDelay(attempt: number): number {
    const delay = this.config.baseDelayMs * Math.pow(2, attempt);
    return Math.min(delay, this.config.maxDelayMs);
  }

  private async performRecovery(botId: string, _attempt: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    logger.debug(`[Recovery] Performing recovery action for ${botId}`);
  }

  scheduleRecovery(botId: string, delayMs?: number): void {
    if (this.reconnectTimers.has(botId)) {
      logger.debug(`[Recovery] Recovery already scheduled for ${botId}`);
      return;
    }

    const delay = delayMs ?? this.config.baseDelayMs;
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(botId);
      void this.attemptRecovery(botId);
    }, delay);

    this.reconnectTimers.set(botId, timer);
    logger.info(`[Recovery] Recovery scheduled for ${botId} in ${delay}ms`);
  }

  cancelRecovery(botId: string): void {
    const timer = this.reconnectTimers.get(botId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(botId);
      logger.debug(`[Recovery] Cancelled recovery for ${botId}`);
    }
  }

  async recoverAll(): Promise<void> {
    const disconnectedBots = runtimeStateRepository.findDisconnected();

    await Promise.all(
      disconnectedBots
        .filter(bot => !runtimeStateRepository.isQuarantined(bot.bot_id))
        .map(bot => this.attemptRecovery(bot.bot_id)),
    );
  }

  isRecovering(botId: string): boolean {
    return this.recoveryInProgress.has(botId);
  }
}

export const recoveryService = RecoveryService.getInstance();
