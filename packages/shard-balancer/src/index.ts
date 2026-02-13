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
 * Optional variance fields enable risk-adjusted balancing.
 */
export interface TestTimingEntry {
  readonly testId: string;
  readonly file: string;
  readonly estimatedDuration: number;
  /** Standard deviation of recent durations — used for risk-adjusted balancing. */
  readonly stdDev?: number;
}

/**
 * Compute a risk-adjusted (pessimistic) duration estimate.
 *
 * Returns avg + k * stdDev, where k is the risk factor.
 * When stdDev is 0 or undefined, returns avg unchanged.
 * Pure function — quantifies execution time uncertainty as extra duration padding.
 *
 * @param avg - Average duration in ms
 * @param stdDev - Standard deviation of recent durations in ms
 * @param riskFactor - How many standard deviations to add (0 = no padding, 1 = 68th percentile, 2 = 95th percentile)
 */
export function computePessimisticDuration(
  avg: number,
  stdDev: number | undefined,
  riskFactor: number,
): number {
  if (!stdDev || riskFactor <= 0) return avg;
  return Math.round(avg + riskFactor * stdDev);
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
 * Aggregates individual test entries by file (since Playwright runs at the
 * file level), then sorts files by total duration descending and assigns
 * each file to the shard with the lowest current load.
 * Produces near-optimal results for most real-world test suites.
 */
export class LPTStrategy implements ShardStrategy {
  readonly name = 'lpt' as const;

  balance(tests: readonly TestTimingEntry[], shardCount: number): ShardPlan {
    validateShardCount(shardCount);

    // Aggregate individual test entries by file — Playwright can only
    // shard at the file level, so we must keep all tests in a file together.
    const fileMap = new Map<string, number>();
    for (const test of tests) {
      fileMap.set(test.file, (fileMap.get(test.file) ?? 0) + test.estimatedDuration);
    }

    const files = [...fileMap.entries()].sort((a, b) => b[1] - a[1]);
    const effective = effectiveCount(shardCount, files.length);
    const shards = createEmptyBuckets(effective);

    // Assign each file to the lightest shard
    for (const [file, duration] of files) {
      const lightest = shards.reduce((min, shard) =>
        shard.duration < min.duration ? shard : min,
      );
      lightest.tests.push(file);
      lightest.duration += duration;
    }

    // Calculate improvement over naive (even count) distribution
    const totalDuration = [...fileMap.values()].reduce((sum, d) => sum + d, 0);
    const maxDuration = Math.max(...shards.map((s) => s.duration), 0);
    const naiveMax = totalDuration / effective;
    const improvement =
      naiveMax > 0 ? ((naiveMax - maxDuration) / naiveMax) * 100 : 0;

    return toShardPlan(shards, 'lpt', tests.length, Math.round(improvement * 100) / 100);
  }
}

/**
 * Simple round-robin distribution — assigns files to shards in order.
 * Aggregates by file first, then distributes.
 * No optimization, useful as a baseline or when no timing data is available.
 */
export class RoundRobinStrategy implements ShardStrategy {
  readonly name = 'round-robin' as const;

  balance(tests: readonly TestTimingEntry[], shardCount: number): ShardPlan {
    validateShardCount(shardCount);

    // Aggregate by file
    const fileMap = new Map<string, number>();
    for (const test of tests) {
      fileMap.set(test.file, (fileMap.get(test.file) ?? 0) + test.estimatedDuration);
    }

    const files = [...fileMap.entries()];
    const effective = effectiveCount(shardCount, files.length);
    const shards = createEmptyBuckets(effective);

    for (let i = 0; i < files.length; i++) {
      const [file, duration] = files[i]!;
      const idx = i % effective;
      shards[idx]!.tests.push(file);
      shards[idx]!.duration += duration;
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
 *
 * When riskFactor > 0 and stdDev data is available, uses pessimistic
 * duration estimates (avg + k * stdDev) to make shard balancing resilient
 * to execution time variance.
 */
export function timingDataToEntries(
  timingData: readonly ShardTimingData[],
  defaultDuration: number,
  riskFactor: number = 0,
): TestTimingEntry[] {
  return timingData.map((td) => {
    const baseDuration = td.avgDuration > 0 ? td.avgDuration : defaultDuration;
    const stdDev = td.stdDev ?? 0;
    const estimatedDuration = riskFactor > 0
      ? computePessimisticDuration(baseDuration, stdDev, riskFactor)
      : baseDuration;

    return {
      testId: td.testId,
      file: td.file,
      estimatedDuration,
      stdDev,
    };
  });
}

/**
 * Calculate the optimal number of shards to hit a target wall-clock duration.
 *
 * Aggregates tests by file (since Playwright shards at file level), sums total
 * estimated duration, then divides by the target. Result is clamped between 1
 * and min(maxShards, fileCount) so we never exceed the file count or budget.
 *
 * Pure function — no I/O.
 */
export function calculateOptimalShardCount(
  entries: readonly TestTimingEntry[],
  targetDurationMs: number,
  maxShards: number,
): number {
  if (entries.length === 0 || targetDurationMs <= 0) {
    return 1;
  }

  // Aggregate by file — Playwright can only shard at file level
  const fileMap = new Map<string, number>();
  for (const entry of entries) {
    fileMap.set(entry.file, (fileMap.get(entry.file) ?? 0) + entry.estimatedDuration);
  }

  const totalDuration = [...fileMap.values()].reduce((sum, d) => sum + d, 0);
  const fileCount = fileMap.size;

  // The longest single file is a hard floor — can't go below it no matter the shard count
  const longestFile = Math.max(...fileMap.values());

  // Ideal shard count to hit the target (but can't split a file across shards)
  const idealCount = Math.ceil(totalDuration / targetDurationMs);

  // Clamp: at least 1, at most min(maxShards, fileCount)
  const upperBound = Math.min(maxShards, fileCount);
  const clamped = Math.max(1, Math.min(idealCount, upperBound));

  return clamped;
}

// Re-export types and strategies
export type { ShardPlan, ShardAssignment, ShardTimingData };
