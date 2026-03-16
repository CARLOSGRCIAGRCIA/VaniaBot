import { logger } from '@/utils/logger.js';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  monitoringPeriod: number;
  name?: string;
}

export interface CircuitMetrics {
  failures: number;
  successes: number;
  lastFailure: number | null;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  state: CircuitState;
  totalRequests: number;
  failedRequests: number;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000,
  monitoringPeriod: 60000,
  name: 'circuit-breaker',
};

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailure: number | null = null;
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private nextAttempt: number = 0;
  private options: CircuitBreakerOptions;
  private readonly name: string;

  private metrics: CircuitMetrics = {
    failures: 0,
    successes: 0,
    lastFailure: null,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    state: 'CLOSED',
    totalRequests: 0,
    failedRequests: 0,
  };

  constructor(options: Partial<CircuitBreakerOptions> = {}, name?: string) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.name = name || this.options.name || 'circuit-breaker';
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.metrics.totalRequests++;

    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        this.metrics.failedRequests++;
        throw new CircuitOpenError(
          `Circuit ${this.name} is OPEN. Next attempt: ${new Date(this.nextAttempt).toISOString()}`,
          this.nextAttempt - Date.now(),
        );
      }
      this.state = 'HALF_OPEN';
      logger.info(`🔄 Circuit ${this.name}: HALF_OPEN - Testing recovery`);
    }

    try {
      const result = await this.executeWithTimeout(operation);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Operation timed out after ${this.options.timeout}ms`)),
          this.options.timeout,
        ),
      ),
    ]);
  }

  private onSuccess(): void {
    this.failures = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses++;

    this.metrics.successes++;
    this.metrics.consecutiveSuccesses = this.consecutiveSuccesses;
    this.metrics.consecutiveFailures = 0;

    if (this.state === 'HALF_OPEN' && this.consecutiveSuccesses >= this.options.successThreshold) {
      this.state = 'CLOSED';
      this.consecutiveSuccesses = 0;
      logger.info(`✅ Circuit ${this.name}: CLOSED - Recovered successfully`);
    }

    this.updateMetrics();
  }

  private onFailure(): void {
    this.failures++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    this.lastFailure = Date.now();

    this.metrics.failures++;
    this.metrics.lastFailure = this.lastFailure;
    this.metrics.consecutiveFailures = this.consecutiveFailures;
    this.metrics.consecutiveSuccesses = 0;
    this.metrics.failedRequests++;

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.options.timeout;
      logger.warn(
        `⚠️ Circuit ${this.name}: OPEN - Recovery failed, will retry at ${new Date(this.nextAttempt).toISOString()}`,
      );
    } else if (this.consecutiveFailures >= this.options.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.options.timeout;
      logger.warn(
        `⚠️ Circuit ${this.name}: OPEN - Threshold reached (${this.consecutiveFailures}/${this.options.failureThreshold}), will retry at ${new Date(this.nextAttempt).toISOString()}`,
      );
    }

    this.updateMetrics();
  }

  private updateMetrics(): void {
    this.metrics.state = this.state;
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics(): CircuitMetrics {
    return {
      ...this.metrics,
    };
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.lastFailure = null;
    this.nextAttempt = 0;
    this.metrics = {
      failures: 0,
      successes: 0,
      lastFailure: null,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      state: 'CLOSED',
      totalRequests: 0,
      failedRequests: 0,
    };
    logger.info(`🔄 Circuit ${this.name}: RESET - Manual reset performed`);
  }

  getHealthStatus(): {
    healthy: boolean;
    state: CircuitState;
    metrics: CircuitMetrics;
  } {
    return {
      healthy: this.state === 'CLOSED',
      state: this.state,
      metrics: this.getMetrics(),
    };
  }
}

export class CircuitOpenError extends Error {
  public readonly retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = 'CircuitOpenError';
    this.retryAfter = retryAfter;
  }
}

export class CircuitBreakerManager {
  private static instance: CircuitBreakerManager;
  private circuits: Map<string, CircuitBreaker> = new Map();

  private constructor() {}

  static getInstance(): CircuitBreakerManager {
    if (!CircuitBreakerManager.instance) {
      CircuitBreakerManager.instance = new CircuitBreakerManager();
    }
    return CircuitBreakerManager.instance;
  }

  getOrCreate(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (!this.circuits.has(name)) {
      this.circuits.set(name, new CircuitBreaker(options, name));
      logger.debug(`🔧 Circuit breaker created: ${name}`);
    }
    const circuit = this.circuits.get(name);
    if (!circuit) {
      throw new Error(`Failed to create circuit breaker: ${name}`);
    }
    return circuit;
  }

  get(name: string): CircuitBreaker | undefined {
    return this.circuits.get(name);
  }

  getAllCircuits(): Record<string, ReturnType<CircuitBreaker['getHealthStatus']>> {
    const result: Record<string, ReturnType<CircuitBreaker['getHealthStatus']>> = {};
    for (const [name, circuit] of this.circuits.entries()) {
      result[name] = circuit.getHealthStatus();
    }
    return result;
  }

  resetAll(): void {
    for (const circuit of this.circuits.values()) {
      circuit.reset();
    }
    logger.info('🔄 All circuit breakers reset');
  }

  remove(name: string): boolean {
    return this.circuits.delete(name);
  }
}

export const circuitBreakerManager = CircuitBreakerManager.getInstance();
