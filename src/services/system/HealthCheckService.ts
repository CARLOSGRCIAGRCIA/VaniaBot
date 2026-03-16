import { circuitBreakerManager } from './CircuitBreakerService.js';
import { serviceManager } from './Servicemanager.js';
import { existsSync, statSync } from 'fs';
import { join } from 'path';

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
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message?: string;
  latency?: number;
  details?: Record<string, unknown>;
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

    const healthy = summary.failed === 0;
    const status = healthy ? (summary.warnings > 0 ? 'degraded' : 'healthy') : 'unhealthy';

    return {
      healthy,
      status,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - START_TIME,
      checks,
      summary,
    };
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
