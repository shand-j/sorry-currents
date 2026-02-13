import type {
  ShardPlan,
  ShardAssignment,
  ShardTimingData,
} from '@sorry-currents/core';

/**
 * Strategy interface for shard balancing algorithms.
 * Implementations distribute tests across shards to minimize total wall-clock time.
 */
export interface ShardStrategy {
  readonly name: string;
  balance(tests: readonly TestTimingEntry[], shardCount: number): ShardPlan;
}

/**
 * Input entry for the shard balancer — a test with its estimated duration.
 */
export interface TestTimingEntry {
  readonly testId: string;
  readonly file: string;
  readonly estimatedDuration: number;
}

// --- Shared helpers ---

function validateShardCount(shardCount: number): void {
  if (shardCount <= 0) {
    throw new Error('shardCount must be positive');
  }
}

function effectiveCount(shardCount: number, testCount: number): number {
  return Math.min(shardCount, testCount || 1);
}

function createEmptyBuckets(count: number): { tests: string[]; duration: number }[] {
  return Array.from({ length: count }, () => ({ tests: [], duration: 0 }));
}

function toShardPlan(
  buckets: { tests: string[]; duration: number }[],
  strategy: ShardPlan['strategy'],
  totalTests: number,
  improvement?: number,
): ShardPlan {
  const shardAssignments: ShardAssignment[] = buckets.map((shard, i) => ({
    shardIndex: i + 1,
    tests: shard.tests,
    estimatedDuration: shard.duration,
  }));

  const durations = shardAssignments.map((s) => s.estimatedDuration);

  return {
    shards: shardAssignments,
    strategy,
    totalTests,
    maxShardDuration: durations.length > 0 ? Math.max(...durations) : 0,
    minShardDuration: durations.length > 0 ? Math.min(...durations) : 0,
    improvement,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Longest Processing Time First (LPT) algorithm.
 *
 * Greedy heuristic that sorts tests by duration descending,
 * then assigns each test to the shard with the lowest current load.
 * Produces near-optimal results for most real-world test suites.
 */
export class LPTStrategy implements ShardStrategy {
  readonly name = 'lpt' as const;

  balance(tests: readonly TestTimingEntry[], shardCount: number): ShardPlan {
    validateShardCount(shardCount);
    const effective = effectiveCount(shardCount, tests.length);

    // Sort by duration descending
    const sorted = [...tests].sort(
      (a, b) => b.estimatedDuration - a.estimatedDuration,
    );

    const shards = createEmptyBuckets(effective);

    // Assign each test to the lightest shard
    for (const test of sorted) {
      const lightest = shards.reduce((min, shard) =>
        shard.duration < min.duration ? shard : min,
      );
      lightest.tests.push(test.file);
      lightest.duration += test.estimatedDuration;
    }

    // Calculate improvement over naive (even count) distribution
    const totalDuration = tests.reduce((sum, t) => sum + t.estimatedDuration, 0);
    const maxDuration = Math.max(...shards.map((s) => s.duration), 0);
    const naiveMax = totalDuration / effective;
    const improvement =
      naiveMax > 0 ? ((naiveMax - maxDuration) / naiveMax) * 100 : 0;

    return toShardPlan(shards, 'lpt', tests.length, Math.round(improvement * 100) / 100);
  }
}

/**
 * Simple round-robin distribution — assigns tests to shards in order.
 * No optimization, useful as a baseline or when no timing data is available.
 */
export class RoundRobinStrategy implements ShardStrategy {
  readonly name = 'round-robin' as const;

  balance(tests: readonly TestTimingEntry[], shardCount: number): ShardPlan {
    validateShardCount(shardCount);
    const effective = effectiveCount(shardCount, tests.length);
    const shards = createEmptyBuckets(effective);

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i]!;
      const idx = i % effective;
      shards[idx]!.tests.push(test.file);
      shards[idx]!.duration += test.estimatedDuration;
    }

    return toShardPlan(shards, 'round-robin', tests.length);
  }
}

/**
 * File-group strategy — keeps tests from the same file on the same shard.
 *
 * Groups test entries by file, then distributes groups using LPT on
 * the aggregate file duration. Useful when tests within a file share
 * expensive setup (e.g. browser context or database seeding).
 */
export class FileGroupStrategy implements ShardStrategy {
  readonly name = 'file-group' as const;

  balance(tests: readonly TestTimingEntry[], shardCount: number): ShardPlan {
    validateShardCount(shardCount);

    // Group tests by file, summing durations
    const fileMap = new Map<string, { tests: TestTimingEntry[]; totalDuration: number }>();
    for (const test of tests) {
      const existing = fileMap.get(test.file);
      if (existing) {
        existing.tests.push(test);
        existing.totalDuration += test.estimatedDuration;
      } else {
        fileMap.set(test.file, { tests: [test], totalDuration: test.estimatedDuration });
      }
    }

    const groups = [...fileMap.entries()].sort(
      (a, b) => b[1].totalDuration - a[1].totalDuration,
    );

    const effective = effectiveCount(shardCount, groups.length);
    const shards = createEmptyBuckets(effective);

    // LPT on file groups
    for (const [file, group] of groups) {
      const lightest = shards.reduce((min, shard) =>
        shard.duration < min.duration ? shard : min,
      );
      lightest.tests.push(file);
      lightest.duration += group.totalDuration;
    }

    return toShardPlan(shards, 'file-group', tests.length);
  }
}

// --- Strategy registry ---

const strategyRegistry = new Map<string, ShardStrategy>([
  ['lpt', new LPTStrategy()],
  ['round-robin', new RoundRobinStrategy()],
  ['file-group', new FileGroupStrategy()],
]);

/** Get a strategy by name, or undefined if not found. */
export function getStrategy(name: string): ShardStrategy | undefined {
  return strategyRegistry.get(name);
}

/** List all registered strategy names. */
export function listStrategies(): readonly string[] {
  return [...strategyRegistry.keys()];
}

/**
 * Convert ShardTimingData[] to TestTimingEntry[], applying a default
 * duration for tests without history data.
 */
export function timingDataToEntries(
  timingData: readonly ShardTimingData[],
  defaultDuration: number,
): TestTimingEntry[] {
  return timingData.map((td) => ({
    testId: td.testId,
    file: td.file,
    estimatedDuration: td.avgDuration > 0 ? td.avgDuration : defaultDuration,
  }));
}

// Re-export types and strategies
export type { ShardPlan, ShardAssignment, ShardTimingData };
