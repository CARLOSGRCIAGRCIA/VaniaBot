import { circuitBreakerManager } from './CircuitBreakerService.js';
import { serviceManager } from './Servicemanager.js';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { logger } from '@/utils/logger.js';

export interface HealthCheckResult {
  healthy: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: HealthCheck[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  alerts: HealthAlert[];
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message?: string;
  latency?: number;
  details?: Record<string, unknown>;
}

export interface HealthAlert {
  severity: 'info' | 'warning' | 'critical';
  source: string;
  message: string;
  timestamp: string;
}

export interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  process: {
    uptime: number;
    pid: number;
    platform: string;
    nodeVersion: string;
  };
  messageStats?: {
    received: number;
    processed: number;
    commands: number;
    errors: number;
    spamBlocked: number;
    avgProcessingTime: number;
  };
}

const START_TIME = Date.now();

export class HealthCheckService {
  private static instance: HealthCheckService;

  private constructor() {}

  static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService();
    }
    return HealthCheckService.instance;
  }

  async performHealthCheck(): Promise<HealthCheckResult> {
    const checkPromises: Promise<HealthCheck>[] = [];

    checkPromises.push(this.checkDatabase());
    checkPromises.push(Promise.resolve(this.checkSession()));
    checkPromises.push(Promise.resolve(this.checkTempStorage()));
    checkPromises.push(Promise.resolve(this.checkCircuitBreakers()));
    checkPromises.push(Promise.resolve(this.checkMemory()));
    checkPromises.push(this.checkAIService());

    const checks = await Promise.all(checkPromises);

    const summary = {
      total: checks.length,
      passed: checks.filter(c => c.status === 'pass').length,
      failed: checks.filter(c => c.status === 'fail').length,
      warnings: checks.filter(c => c.status === 'warn').length,
    };

    const metrics = this.getSystemMetrics();
    const healthy = summary.failed === 0;
    const status = healthy ? (summary.warnings > 0 ? 'degraded' : 'healthy') : 'unhealthy';
    const alerts = this.generateAlerts(checks, metrics);

    return {
      healthy,
      status,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - START_TIME,
      checks,
      summary,
      alerts,
    };
  }

  private generateAlerts(checks: HealthCheck[], metrics: SystemMetrics): HealthAlert[] {
    const alerts: HealthAlert[] = [];
    const timestamp = new Date().toISOString();

    for (const check of checks) {
      if (check.status === 'fail') {
        alerts.push({
          severity: 'critical',
          source: check.name,
          message: check.message || 'Check failed',
          timestamp,
        });
        logger.error(`🚨 Health alert [CRITICAL]: ${check.name} - ${check.message}`);
      } else if (check.status === 'warn') {
        alerts.push({
          severity: 'warning',
          source: check.name,
          message: check.message || 'Check warning',
          timestamp,
        });
        logger.warn(`⚠️ Health alert [WARNING]: ${check.name} - ${check.message}`);
      }
    }

    if (metrics.messageStats && metrics.messageStats.errors > 10) {
      alerts.push({
        severity: 'warning',
        source: 'message_stats',
        message: `${metrics.messageStats.errors} errors recorded`,
        timestamp,
      });
    }

    if (metrics.memory.percentage > 85) {
      alerts.push({
        severity: 'critical',
        source: 'memory',
        message: `Memory usage at ${metrics.memory.percentage.toFixed(1)}%`,
        timestamp,
      });
    }

    return alerts;
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      const db = serviceManager.db;
      const isConnected = db?.isConnected() ?? false;

      if (!isConnected) {
        return {
          name: 'database',
          status: 'fail',
          message: 'Database not connected',
          latency: Date.now() - start,
        };
      }

      return {
        name: 'database',
        status: 'pass',
        message: `Connected to ${db ? (db as unknown as { constructor?: { name?: string } }).constructor?.name || 'database' : 'unknown'}`,
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - start,
      };
    }
  }

  private checkSession(): HealthCheck {
    const start = Date.now();
    try {
      const sessionPath = join(process.cwd(), 'vaniasession', 'creds.json');

      if (!existsSync(sessionPath)) {
        return {
          name: 'session',
          status: 'fail',
          message: 'Session file not found',
          latency: Date.now() - start,
        };
      }

      const stats = statSync(sessionPath);
      const age = Date.now() - stats.mtimeMs;
      const oneDay = 24 * 60 * 60 * 1000;

      if (age > oneDay) {
        return {
          name: 'session',
          status: 'warn',
          message: `Session is older than 24h (${Math.round(age / oneDay)} days)`,
          latency: Date.now() - start,
          details: { lastModified: stats.mtime },
        };
      }

      return {
        name: 'session',
        status: 'pass',
        message: 'Session active and recent',
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        name: 'session',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - start,
      };
    }
  }

  private checkTempStorage(): HealthCheck {
    const start = Date.now();
    try {
      const tempPath = join(process.cwd(), 'data', 'temp');

      if (!existsSync(tempPath)) {
        return {
          name: 'temp_storage',
          status: 'warn',
          message: 'Temp directory does not exist',
          latency: Date.now() - start,
        };
      }

      return {
        name: 'temp_storage',
        status: 'pass',
        message: 'Temp storage accessible',
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        name: 'temp_storage',
        status: 'warn',
        message: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - start,
      };
    }
  }

  private checkCircuitBreakers(): HealthCheck {
    const start = Date.now();
    try {
      const circuits = circuitBreakerManager.getAllCircuits();
      const circuitNames = Object.keys(circuits);

      if (circuitNames.length === 0) {
        return {
          name: 'circuit_breakers',
          status: 'pass',
          message: 'No circuit breakers active',
          latency: Date.now() - start,
        };
      }

      const openCircuits = circuitNames.filter(name => circuits[name].state === 'OPEN');

      if (openCircuits.length > 0) {
        return {
          name: 'circuit_breakers',
          status: 'warn',
          message: `${openCircuits.length} circuit(s) open: ${openCircuits.join(', ')}`,
          latency: Date.now() - start,
          details: circuits,
        };
      }

      return {
        name: 'circuit_breakers',
        status: 'pass',
        message: `${circuitNames.length} circuit(s) healthy`,
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        name: 'circuit_breakers',
        status: 'warn',
        message: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - start,
      };
    }
  }

  private checkMemory(): HealthCheck {
    const start = Date.now();
    try {
      const memUsage = process.memoryUsage();
      const totalMem = memUsage.heapTotal;
      const usedMem = memUsage.heapUsed;
      const percentage = (usedMem / totalMem) * 100;

      if (percentage > 90) {
        return {
          name: 'memory',
          status: 'fail',
          message: `Memory critical: ${percentage.toFixed(1)}% used`,
          latency: Date.now() - start,
          details: {
            heapUsed: `${(usedMem / 1024 / 1024).toFixed(2)}MB`,
            heapTotal: `${(totalMem / 1024 / 1024).toFixed(2)}MB`,
          },
        };
      }

      if (percentage > 75) {
        return {
          name: 'memory',
          status: 'warn',
          message: `Memory high: ${percentage.toFixed(1)}% used`,
          latency: Date.now() - start,
          details: {
            heapUsed: `${(usedMem / 1024 / 1024).toFixed(2)}MB`,
            heapTotal: `${(totalMem / 1024 / 1024).toFixed(2)}MB`,
          },
        };
      }

      return {
        name: 'memory',
        status: 'pass',
        message: `Memory OK: ${percentage.toFixed(1)}% used`,
        latency: Date.now() - start,
        details: {
          heapUsed: `${(usedMem / 1024 / 1024).toFixed(2)}MB`,
          heapTotal: `${(totalMem / 1024 / 1024).toFixed(2)}MB`,
        },
      };
    } catch (error) {
      return {
        name: 'memory',
        status: 'warn',
        message: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - start,
      };
    }
  }

  private async checkAIService(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      const { env } = await import('@/config/env.js');

      if (!env.GROQ_API_KEY) {
        return {
          name: 'ai_service',
          status: 'warn',
          message: 'AI service not configured (GROQ_API_KEY missing)',
          latency: Date.now() - start,
        };
      }

      return {
        name: 'ai_service',
        status: 'pass',
        message: 'AI service configured',
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        name: 'ai_service',
        status: 'warn',
        message: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - start,
      };
    }
  }

  getSystemMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();
    const totalMem = memUsage.heapTotal;
    const usedMem = memUsage.heapUsed;

    const metrics: SystemMetrics = {
      memory: {
        used: usedMem,
        total: totalMem,
        percentage: (usedMem / totalMem) * 100,
      },
      cpu: {
        usage: process.cpuUsage().user / 1000000,
      },
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        platform: process.platform,
        nodeVersion: process.version,
      },
    };

    try {
      const client = globalThis.client;
      if (client) {
        const stats = client.getStats();
        metrics.messageStats = {
          received: stats.messagesReceived,
          processed: stats.messagesProcessed,
          commands: stats.commandsExecuted,
          errors: stats.errorsCount,
          spamBlocked: stats.spamBlocked,
          avgProcessingTime: stats.avgProcessingTime,
        };
      }
    } catch {
      // Client not available
    }

    return metrics;
  }

  async getDetailedStatus(): Promise<{
    health: HealthCheckResult;
    metrics: SystemMetrics;
    circuits: ReturnType<typeof circuitBreakerManager.getAllCircuits>;
  }> {
    const health = await this.performHealthCheck();
    const metrics = this.getSystemMetrics();
    const circuits = circuitBreakerManager.getAllCircuits();

    return { health, metrics, circuits };
  }
}

export const healthCheckService = HealthCheckService.getInstance();

export interface AutoRestartConfig {
  enabled: boolean;
  checkIntervalMs: number;
  restartThreshold: {
    consecutiveFailures: number;
    memoryPercentage: number;
    errorRate: number;
  };
}

const DEFAULT_RESTART_CONFIG: AutoRestartConfig = {
  enabled: true,
  checkIntervalMs: 60000,
  restartThreshold: {
    consecutiveFailures: 5,
    memoryPercentage: 95,
    errorRate: 20,
  },
};

export class AutoRestartService {
  private static instance: AutoRestartService;
  private config: AutoRestartConfig;
  private consecutiveFailures = 0;
  private errorCount = 0;
  private checkCount = 0;
  private restartTimer: ReturnType<typeof setInterval> | null = null;
  private onRestartCallback: (() => void) | null = null;

  private constructor(config: Partial<AutoRestartConfig> = {}) {
    this.config = { ...DEFAULT_RESTART_CONFIG, ...config };
  }

  static getInstance(config?: Partial<AutoRestartConfig>): AutoRestartService {
    if (!AutoRestartService.instance) {
      AutoRestartService.instance = new AutoRestartService(config);
    }
    return AutoRestartService.instance;
  }

  setOnRestartCallback(callback: () => void): void {
    this.onRestartCallback = callback;
  }

  start(): void {
    if (!this.config.enabled) {
      logger.info('Auto-restart service disabled');
      return;
    }

    logger.info('🚀 Auto-restart service started');
    this.restartTimer = setInterval(() => {
      void this.checkAndRestart();
    }, this.config.checkIntervalMs);
  }

  stop(): void {
    if (this.restartTimer) {
      clearInterval(this.restartTimer);
      this.restartTimer = null;
    }
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  recordFailure(): void {
    this.consecutiveFailures++;
    logger.warn(`⚠️ Consecutive failures: ${this.consecutiveFailures}`);
  }

  recordError(): void {
    this.errorCount++;
  }

  private async checkAndRestart(): Promise<void> {
    this.checkCount++;
    const metrics = healthCheckService.getSystemMetrics();

    let shouldRestart = false;
    let reason = '';

    if (metrics.memory.percentage > this.config.restartThreshold.memoryPercentage) {
      shouldRestart = true;
      reason = `Memory critical: ${metrics.memory.percentage.toFixed(1)}%`;
    }

    if (this.consecutiveFailures >= this.config.restartThreshold.consecutiveFailures) {
      shouldRestart = true;
      reason = `${this.consecutiveFailures} consecutive failures detected`;
    }

    if (this.checkCount > 10) {
      const recentErrors = this.errorCount;
      const errorRate = (recentErrors / this.checkCount) * 100;
      if (errorRate > this.config.restartThreshold.errorRate) {
        shouldRestart = true;
        reason = `High error rate: ${errorRate.toFixed(1)}%`;
      }
      this.errorCount = 0;
      this.checkCount = 0;
    }

    if (shouldRestart) {
      logger.error(`🚨 AUTO-RESTART triggered: ${reason}`);
      this.stop();
      if (this.onRestartCallback) {
        this.onRestartCallback();
      } else {
        logger.error('No restart callback configured');
      }
    }
  }
}
