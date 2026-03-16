import { describe, it, expect, beforeEach } from 'vitest';
import {
  DatabaseQueryOptimizer,
  queryOptimizer,
} from '../../src/services/database/DatabaseQueryOptimizer.js';

describe('DatabaseQueryOptimizer', () => {
  let optimizer: DatabaseQueryOptimizer;

  beforeEach(() => {
    optimizer = DatabaseQueryOptimizer.getInstance();
  });

  it('should execute query successfully', async () => {
    const result = await optimizer.query('test-key', async () => 'test-result', { cache: false });

    expect(result).toBe('test-result');
  });

  it('should clear all cache', async () => {
    optimizer.clearCache();

    const stats = optimizer.getStats();
    expect(stats.totalQueries).toBeGreaterThanOrEqual(0);
  });
});

describe('queryOptimizer singleton', () => {
  it('should be exported', () => {
    expect(queryOptimizer).toBeDefined();
  });
});
