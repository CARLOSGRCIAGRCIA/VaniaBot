import { describe, it, expect, beforeEach } from 'vitest';
import {
  CircuitBreaker,
  CircuitOpenError,
  circuitBreakerManager,
} from '../../src/services/system/CircuitBreakerService.js';

describe('CircuitBreaker', () => {
  let circuit: CircuitBreaker;

  beforeEach(() => {
    circuit = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 100,
      name: 'test-circuit',
    });
  });

  it('should start in CLOSED state', () => {
    expect(circuit.getState()).toBe('CLOSED');
  });

  it('should remain CLOSED when operations succeed', async () => {
    await circuit.execute(async () => 'success');
    expect(circuit.getState()).toBe('CLOSED');
  });

  it('should track failures correctly', async () => {
    await expect(
      circuit.execute(async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow();
    await expect(
      circuit.execute(async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow();

    const metrics = circuit.getMetrics();
    expect(metrics.failures).toBeGreaterThanOrEqual(2);
  });

  it('should OPEN after failure threshold', async () => {
    for (let i = 0; i < 3; i++) {
      try {
        await circuit.execute(async () => {
          throw new Error('fail');
        });
      } catch {}
    }

    expect(circuit.getState()).toBe('OPEN');
  });

  it('should throw CircuitOpenError when OPEN', async () => {
    for (let i = 0; i < 3; i++) {
      try {
        await circuit.execute(async () => {
          throw new Error('fail');
        });
      } catch {}
    }

    await expect(circuit.execute(async () => 'success')).rejects.toThrow(CircuitOpenError);
  });

  it('should reset correctly', async () => {
    for (let i = 0; i < 3; i++) {
      try {
        await circuit.execute(async () => {
          throw new Error('fail');
        });
      } catch {}
    }

    circuit.reset();

    expect(circuit.getState()).toBe('CLOSED');
    expect(circuit.getMetrics().failures).toBe(0);
  });

  it('should return correct health status', () => {
    const health = circuit.getHealthStatus();
    expect(health.healthy).toBe(true);
    expect(health.state).toBe('CLOSED');
  });

  it('should increment total requests', () => {
    const initial = circuit.getMetrics().totalRequests;

    circuit.execute(async () => 'success');
    circuit.execute(async () => 'success');

    expect(circuit.getMetrics().totalRequests).toBeGreaterThanOrEqual(initial + 2);
  });
});

describe('CircuitBreakerManager', () => {
  beforeEach(() => {
    circuitBreakerManager.remove('test-get');
    circuitBreakerManager.remove('test-get-2');
  });

  it('should create circuit on first access', () => {
    const cb = circuitBreakerManager.getOrCreate('test-get', { failureThreshold: 5 });
    expect(cb).toBeDefined();
    expect(cb.getState()).toBe('CLOSED');
  });

  it('should return existing circuit', () => {
    const cb1 = circuitBreakerManager.getOrCreate('test-get-2', { failureThreshold: 3 });
    const cb2 = circuitBreakerManager.getOrCreate('test-get-2', { failureThreshold: 10 });
    expect(cb1).toBe(cb2);
  });

  it('should get all circuits', () => {
    circuitBreakerManager.getOrCreate('circuit-a');
    circuitBreakerManager.getOrCreate('circuit-b');

    const all = circuitBreakerManager.getAllCircuits();
    expect(all['circuit-a']).toBeDefined();
    expect(all['circuit-b']).toBeDefined();
  });

  it('should remove circuit', () => {
    circuitBreakerManager.getOrCreate('remove-test');
    expect(circuitBreakerManager.get('remove-test')).toBeDefined();

    circuitBreakerManager.remove('remove-test');
    expect(circuitBreakerManager.get('remove-test')).toBeUndefined();
  });
});
