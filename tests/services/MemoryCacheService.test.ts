import { describe, it, expect, beforeEach } from 'vitest';
import {
  LruMemoryCache,
  createCache,
  globalCache,
} from '../../src/services/system/MemoryCacheService.js';

describe('LruMemoryCache', () => {
  let cache: LruMemoryCache<string>;

  beforeEach(() => {
    cache = new LruMemoryCache<string>({
      maxSize: 3,
      ttl: 1000,
      cleanupInterval: 60000,
    });
  });

  it('should set and get value', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should return null for missing key', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('should delete entry', () => {
    cache.set('key1', 'value1');
    expect(cache.delete('key1')).toBe(true);
    expect(cache.get('key1')).toBeNull();
  });

  it('should clear all entries', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.clear();

    expect(cache.size()).toBe(0);
  });

  it('should check if key exists', () => {
    cache.set('key1', 'value1');
    expect(cache.has('key1')).toBe(true);
    expect(cache.has('key2')).toBe(false);
  });

  it('should return correct size', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    expect(cache.size()).toBe(2);
  });
});

describe('createCache', () => {
  it('should create cache with custom options', () => {
    const cache = createCache<string>({
      maxSize: 100,
      ttl: 5000,
    });

    cache.set('test', 'value');
    expect(cache.get('test')).toBe('value');
  });
});

describe('globalCache', () => {
  it('should be initialized', () => {
    expect(globalCache).toBeDefined();
  });

  it('should be usable', () => {
    globalCache.set('global1', 'test');
    expect(globalCache.get('global1')).toBe('test');
  });
});
