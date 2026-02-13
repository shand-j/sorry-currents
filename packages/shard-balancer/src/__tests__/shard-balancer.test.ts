import { describe, expect, it } from 'vitest';

import {
  LPTStrategy,
  RoundRobinStrategy,
  FileGroupStrategy,
  getStrategy,
  listStrategies,
  timingDataToEntries,
  calculateOptimalShardCount,
  type TestTimingEntry,
} from '../index.js';

describe('LPTStrategy', () => {
  const strategy = new LPTStrategy();

  it('should balance 4 tests across 2 shards optimally', () => {
    const tests: TestTimingEntry[] = [
      { testId: 'a', file: 'a.spec.ts', estimatedDuration: 10_000 },
      { testId: 'b', file: 'b.spec.ts', estimatedDuration: 10_000 },
      { testId: 'c', file: 'c.spec.ts', estimatedDuration: 2_000 },
      { testId: 'd', file: 'd.spec.ts', estimatedDuration: 3_000 },
    ];
    const plan = strategy.balance(tests, 2);

    // LPT: a(10s) + d(3s) = 13s, b(10s) + c(2s) = 12s
    expect(plan.maxShardDuration).toBeLessThanOrEqual(13_000);
    expect(plan.shards).toHaveLength(2);
    expect(plan.totalTests).toBe(4);
    expect(plan.strategy).toBe('lpt');
  });

  it('should handle single test', () => {
    const tests: TestTimingEntry[] = [
      { testId: 'a', file: 'a.spec.ts', estimatedDuration: 5000 },
    ];
    const plan = strategy.balance(tests, 4);

    expect(plan.shards).toHaveLength(1);
    expect(plan.shards[0]!.tests).toEqual(['a.spec.ts']);
    expect(plan.maxShardDuration).toBe(5000);
  });

  it('should handle more shards than tests', () => {
    const tests: TestTimingEntry[] = [
      { testId: 'a', file: 'a.spec.ts', estimatedDuration: 5000 },
      { testId: 'b', file: 'b.spec.ts', estimatedDuration: 3000 },
    ];
    const plan = strategy.balance(tests, 10);

    // Should use at most 2 shards since there are only 2 tests
    expect(plan.shards).toHaveLength(2);
  });

  it('should handle empty test list', () => {
    const plan = strategy.balance([], 4);
    expect(plan.shards).toHaveLength(1);
    expect(plan.totalTests).toBe(0);
  });

  it('should handle tests with zero duration', () => {
    const tests: TestTimingEntry[] = [
      { testId: 'a', file: 'a.spec.ts', estimatedDuration: 0 },
      { testId: 'b', file: 'b.spec.ts', estimatedDuration: 0 },
    ];
    const plan = strategy.balance(tests, 2);

    expect(plan.shards).toHaveLength(2);
    expect(plan.maxShardDuration).toBe(0);
  });

  it('should produce a valid ShardPlan with generatedAt timestamp', () => {
    const tests: TestTimingEntry[] = [
      { testId: 'a', file: 'a.spec.ts', estimatedDuration: 1000 },
    ];
    const plan = strategy.balance(tests, 1);

    expect(plan.generatedAt).toBeDefined();
    expect(() => new Date(plan.generatedAt)).not.toThrow();
  });

  it('should distribute skewed test suite reasonably', () => {
    // One very long test + many short ones
    const tests: TestTimingEntry[] = [
      { testId: 'long', file: 'long.spec.ts', estimatedDuration: 60_000 },
      ...Array.from({ length: 20 }, (_, i) => ({
        testId: `short-${i}`,
        file: `short-${i}.spec.ts`,
        estimatedDuration: 1_000,
      })),
    ];

    const plan = strategy.balance(tests, 4);

    // The max shard must contain at least the long test (60s)
    expect(plan.maxShardDuration).toBeGreaterThanOrEqual(60_000);
    // But should distribute the short tests among other shards
    expect(plan.shards).toHaveLength(4);
  });

  it('should throw for zero shardCount', () => {
    expect(() => strategy.balance([], 0)).toThrow('shardCount must be positive');
  });
});

describe('RoundRobinStrategy', () => {
  const strategy = new RoundRobinStrategy();

  it('should distribute tests evenly by count', () => {
    const tests: TestTimingEntry[] = [
      { testId: 'a', file: 'a.spec.ts', estimatedDuration: 10_000 },
      { testId: 'b', file: 'b.spec.ts', estimatedDuration: 5_000 },
      { testId: 'c', file: 'c.spec.ts', estimatedDuration: 3_000 },
      { testId: 'd', file: 'd.spec.ts', estimatedDuration: 1_000 },
    ];
    const plan = strategy.balance(tests, 2);

    expect(plan.shards).toHaveLength(2);
    expect(plan.strategy).toBe('round-robin');
    expect(plan.shards[0]!.tests).toHaveLength(2);
    expect(plan.shards[1]!.tests).toHaveLength(2);
  });

  it('should handle empty test list', () => {
    const plan = strategy.balance([], 4);
    expect(plan.shards).toHaveLength(1);
    expect(plan.totalTests).toBe(0);
  });

  it('should throw for zero shardCount', () => {
    expect(() => strategy.balance([], 0)).toThrow('shardCount must be positive');
  });
});

describe('FileGroupStrategy', () => {
  const strategy = new FileGroupStrategy();

  it('should keep tests from the same file on the same shard', () => {
    const tests: TestTimingEntry[] = [
      { testId: 'a1', file: 'a.spec.ts', estimatedDuration: 3000 },
      { testId: 'a2', file: 'a.spec.ts', estimatedDuration: 2000 },
      { testId: 'b1', file: 'b.spec.ts', estimatedDuration: 4000 },
      { testId: 'b2', file: 'b.spec.ts', estimatedDuration: 1000 },
    ];

    const plan = strategy.balance(tests, 2);

    expect(plan.strategy).toBe('file-group');
    expect(plan.totalTests).toBe(4);
    expect(plan.shards).toHaveLength(2);

    // Each shard should have exactly one file's tests
    for (const shard of plan.shards) {
      const uniqueFiles = new Set(shard.tests);
      expect(uniqueFiles.size).toBe(1);
    }
  });

  it('should balance file groups by total duration (LPT)', () => {
    const tests: TestTimingEntry[] = [
      { testId: 'a1', file: 'a.spec.ts', estimatedDuration: 10_000 },
      { testId: 'a2', file: 'a.spec.ts', estimatedDuration: 5_000 },
      { testId: 'b1', file: 'b.spec.ts', estimatedDuration: 8_000 },
      { testId: 'c1', file: 'c.spec.ts', estimatedDuration: 2_000 },
    ];

    const plan = strategy.balance(tests, 2);

    // File a total: 15s, File b: 8s, File c: 2s
    // Shard 1: a (15s), Shard 2: b + c (10s)
    expect(plan.maxShardDuration).toBe(15_000);
    expect(plan.minShardDuration).toBe(10_000);
  });

  it('should handle single file', () => {
    const tests: TestTimingEntry[] = [
      { testId: 'a1', file: 'a.spec.ts', estimatedDuration: 3000 },
      { testId: 'a2', file: 'a.spec.ts', estimatedDuration: 2000 },
    ];

    const plan = strategy.balance(tests, 4);
    expect(plan.shards).toHaveLength(1);
    expect(plan.shards[0]!.tests).toEqual(['a.spec.ts']);
  });

  it('should handle empty test list', () => {
    const plan = strategy.balance([], 4);
    expect(plan.shards).toHaveLength(1);
    expect(plan.totalTests).toBe(0);
  });

  it('should throw for zero shardCount', () => {
    expect(() => strategy.balance([], 0)).toThrow('shardCount must be positive');
  });

  it('should handle more shards than files', () => {
    const tests: TestTimingEntry[] = [
      { testId: 'a1', file: 'a.spec.ts', estimatedDuration: 3000 },
      { testId: 'b1', file: 'b.spec.ts', estimatedDuration: 2000 },
    ];

    const plan = strategy.balance(tests, 10);
    expect(plan.shards).toHaveLength(2);
  });
});

describe('getStrategy', () => {
  it('should return LPTStrategy for "lpt"', () => {
    const strategy = getStrategy('lpt');
    expect(strategy).toBeDefined();
    expect(strategy!.name).toBe('lpt');
  });

  it('should return RoundRobinStrategy for "round-robin"', () => {
    const strategy = getStrategy('round-robin');
    expect(strategy).toBeDefined();
    expect(strategy!.name).toBe('round-robin');
  });

  it('should return FileGroupStrategy for "file-group"', () => {
    const strategy = getStrategy('file-group');
    expect(strategy).toBeDefined();
    expect(strategy!.name).toBe('file-group');
  });

  it('should return undefined for unknown strategy', () => {
    const strategy = getStrategy('nonexistent');
    expect(strategy).toBeUndefined();
  });
});

describe('listStrategies', () => {
  it('should return all registered strategy names', () => {
    const names = listStrategies();
    expect(names).toContain('lpt');
    expect(names).toContain('round-robin');
    expect(names).toContain('file-group');
    expect(names).toHaveLength(3);
  });
});

describe('timingDataToEntries', () => {
  it('should convert ShardTimingData to TestTimingEntry', () => {
    const timingData = [
      { testId: 'test1', file: 'a.spec.ts', project: 'default', avgDuration: 5000, p95Duration: 7000, samples: 10 },
      { testId: 'test2', file: 'b.spec.ts', project: 'mobile', avgDuration: 3000, p95Duration: 4500, samples: 5 },
    ];

    const entries = timingDataToEntries(timingData, 10_000);

    expect(entries).toHaveLength(2);
    expect(entries[0]!.testId).toBe('test1');
    expect(entries[0]!.file).toBe('a.spec.ts');
    expect(entries[0]!.estimatedDuration).toBe(5000);
    expect(entries[1]!.estimatedDuration).toBe(3000);
  });

  it('should use default duration for zero avgDuration', () => {
    const timingData = [
      { testId: 'test1', file: 'a.spec.ts', project: 'default', avgDuration: 0, p95Duration: 0, samples: 1 },
    ];

    const entries = timingDataToEntries(timingData, 10_000);
    expect(entries[0]!.estimatedDuration).toBe(10_000);
  });

  it('should handle empty input', () => {
    const entries = timingDataToEntries([], 10_000);
    expect(entries).toHaveLength(0);
  });
});

describe('calculateOptimalShardCount', () => {
  it('should calculate shards to hit target duration', () => {
    // 4 files totaling 120s, target 30s per shard → 4 shards
    const entries: TestTimingEntry[] = [
      { testId: 'a1', file: 'a.spec.ts', estimatedDuration: 40_000 },
      { testId: 'b1', file: 'b.spec.ts', estimatedDuration: 30_000 },
      { testId: 'c1', file: 'c.spec.ts', estimatedDuration: 30_000 },
      { testId: 'd1', file: 'd.spec.ts', estimatedDuration: 20_000 },
    ];
    const result = calculateOptimalShardCount(entries, 30_000, 10);
    expect(result).toBe(4);
  });

  it('should round up fractional shard count', () => {
    // 2 files totaling 50s, target 30s → ceil(50/30)=2
    const entries: TestTimingEntry[] = [
      { testId: 'a1', file: 'a.spec.ts', estimatedDuration: 30_000 },
      { testId: 'b1', file: 'b.spec.ts', estimatedDuration: 20_000 },
    ];
    const result = calculateOptimalShardCount(entries, 30_000, 10);
    expect(result).toBe(2);
  });

  it('should cap at maxShards', () => {
    // 10 files totaling 300s, target 10s → ideal 30, but max is 5
    const entries: TestTimingEntry[] = Array.from({ length: 10 }, (_, i) => ({
      testId: `t${i}`,
      file: `file${i}.spec.ts`,
      estimatedDuration: 30_000,
    }));
    const result = calculateOptimalShardCount(entries, 10_000, 5);
    expect(result).toBe(5);
  });

  it('should cap at file count when fewer files than maxShards', () => {
    // 3 files totaling 90s, target 10s → ideal 9, but only 3 files
    const entries: TestTimingEntry[] = [
      { testId: 'a1', file: 'a.spec.ts', estimatedDuration: 30_000 },
      { testId: 'b1', file: 'b.spec.ts', estimatedDuration: 30_000 },
      { testId: 'c1', file: 'c.spec.ts', estimatedDuration: 30_000 },
    ];
    const result = calculateOptimalShardCount(entries, 10_000, 10);
    expect(result).toBe(3);
  });

  it('should aggregate multiple tests from same file', () => {
    // 2 files: file-a has 3 tests totaling 60s, file-b has 1 test at 20s
    // Total 80s, target 30s → ceil(80/30) = 3, but only 2 files → 2
    const entries: TestTimingEntry[] = [
      { testId: 'a1', file: 'a.spec.ts', estimatedDuration: 20_000 },
      { testId: 'a2', file: 'a.spec.ts', estimatedDuration: 20_000 },
      { testId: 'a3', file: 'a.spec.ts', estimatedDuration: 20_000 },
      { testId: 'b1', file: 'b.spec.ts', estimatedDuration: 20_000 },
    ];
    const result = calculateOptimalShardCount(entries, 30_000, 10);
    expect(result).toBe(2);
  });

  it('should return 1 for empty entries', () => {
    expect(calculateOptimalShardCount([], 30_000, 10)).toBe(1);
  });

  it('should return 1 for zero target duration', () => {
    const entries: TestTimingEntry[] = [
      { testId: 'a1', file: 'a.spec.ts', estimatedDuration: 10_000 },
    ];
    expect(calculateOptimalShardCount(entries, 0, 10)).toBe(1);
  });

  it('should return 1 when total duration fits in target', () => {
    // Total 20s, target 60s → ceil(20/60) = 1
    const entries: TestTimingEntry[] = [
      { testId: 'a1', file: 'a.spec.ts', estimatedDuration: 10_000 },
      { testId: 'b1', file: 'b.spec.ts', estimatedDuration: 10_000 },
    ];
    const result = calculateOptimalShardCount(entries, 60_000, 10);
    expect(result).toBe(1);
  });
});
