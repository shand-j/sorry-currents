import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

import {
  LPTStrategy,
  RoundRobinStrategy,
  FileGroupStrategy,
  type TestTimingEntry,
} from '../index.js';

/**
 * Arbitrary for generating test timing entries.
 */
const testTimingEntryArb = fc.record({
  testId: fc.uuid(),
  file: fc.stringMatching(/^[a-z][a-z0-9-]{0,10}\.spec\.ts$/),
  estimatedDuration: fc.nat({ max: 300_000 }), // 0 to 5 minutes
});

/**
 * Generate an array of test entries with at least 1 item.
 */
const testListArb = fc.array(testTimingEntryArb, { minLength: 1, maxLength: 200 });

/**
 * Shard count: always positive.
 */
const shardCountArb = fc.integer({ min: 1, max: 20 });

describe('LPTStrategy — property-based tests', () => {
  const strategy = new LPTStrategy();

  it('should never lose files: all unique files assigned to exactly one shard', () => {
    fc.assert(
      fc.property(testListArb, shardCountArb, (tests, shards) => {
        const plan = strategy.balance(tests, shards);

        // Strategies aggregate by file — count unique files, not individual tests
        const uniqueFiles = new Set(tests.map((t) => t.file));
        const totalAssigned = plan.shards.reduce(
          (sum, s) => sum + s.tests.length,
          0,
        );
        expect(totalAssigned).toBe(uniqueFiles.size);
        // totalTests still tracks individual test count
        expect(plan.totalTests).toBe(tests.length);
      }),
      { numRuns: 200 },
    );
  });

  it('should produce shard count ≤ requested shards', () => {
    fc.assert(
      fc.property(testListArb, shardCountArb, (tests, shards) => {
        const plan = strategy.balance(tests, shards);
        expect(plan.shards.length).toBeLessThanOrEqual(shards);
        expect(plan.shards.length).toBeGreaterThanOrEqual(1);
      }),
      { numRuns: 200 },
    );
  });

  it('should have maxShardDuration ≥ largest single test', () => {
    fc.assert(
      fc.property(testListArb, shardCountArb, (tests, shards) => {
        const plan = strategy.balance(tests, shards);
        const maxSingleTest = Math.max(
          ...tests.map((t) => t.estimatedDuration),
          0,
        );
        expect(plan.maxShardDuration).toBeGreaterThanOrEqual(maxSingleTest);
      }),
      { numRuns: 200 },
    );
  });

  it('should produce max shard ≤ total duration (never worse than 1 shard)', () => {
    fc.assert(
      fc.property(testListArb, shardCountArb, (tests, shards) => {
        const plan = strategy.balance(tests, shards);
        const totalDuration = tests.reduce(
          (sum, t) => sum + t.estimatedDuration,
          0,
        );
        expect(plan.maxShardDuration).toBeLessThanOrEqual(totalDuration);
      }),
      { numRuns: 200 },
    );
  });

  it('should have sum of shard durations equal total test duration', () => {
    fc.assert(
      fc.property(testListArb, shardCountArb, (tests, shards) => {
        const plan = strategy.balance(tests, shards);
        const sumOfShards = plan.shards.reduce(
          (sum, s) => sum + s.estimatedDuration,
          0,
        );
        const totalDuration = tests.reduce(
          (sum, t) => sum + t.estimatedDuration,
          0,
        );
        expect(sumOfShards).toBe(totalDuration);
      }),
      { numRuns: 200 },
    );
  });

  it('should have 1-based contiguous shard indices', () => {
    fc.assert(
      fc.property(testListArb, shardCountArb, (tests, shards) => {
        const plan = strategy.balance(tests, shards);
        const indices = plan.shards.map((s) => s.shardIndex).sort((a, b) => a - b);
        for (let i = 0; i < indices.length; i++) {
          expect(indices[i]).toBe(i + 1);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('maxShardDuration ≤ optimal + largest file duration (LPT guarantee)', () => {
    fc.assert(
      fc.property(testListArb, shardCountArb, (tests, shards) => {
        const plan = strategy.balance(tests, shards);

        // Aggregate by file to compute file-level metrics
        const fileMap = new Map<string, number>();
        for (const t of tests) {
          fileMap.set(t.file, (fileMap.get(t.file) ?? 0) + t.estimatedDuration);
        }
        const fileDurations = [...fileMap.values()];

        const totalDuration = fileDurations.reduce((sum, d) => sum + d, 0);
        const effectiveShards = Math.min(shards, fileDurations.length || 1);
        const optimal = totalDuration / effectiveShards;
        const maxFileDuration = Math.max(...fileDurations, 0);

        // LPT guarantee at file granularity: makespan ≤ optimal + p_max
        expect(plan.maxShardDuration).toBeLessThanOrEqual(
          optimal + maxFileDuration + 1, // +1 for floating point
        );
      }),
      { numRuns: 200 },
    );
  });
});

describe('RoundRobinStrategy — property-based tests', () => {
  const strategy = new RoundRobinStrategy();

  it('should never lose files', () => {
    fc.assert(
      fc.property(testListArb, shardCountArb, (tests, shards) => {
        const plan = strategy.balance(tests, shards);
        const uniqueFiles = new Set(tests.map((t) => t.file));
        const totalAssigned = plan.shards.reduce(
          (sum, s) => sum + s.tests.length,
          0,
        );
        expect(totalAssigned).toBe(uniqueFiles.size);
      }),
      { numRuns: 100 },
    );
  });

  it('should distribute files with at most 1 difference in count between shards', () => {
    fc.assert(
      fc.property(testListArb, shardCountArb, (tests, shards) => {
        const plan = strategy.balance(tests, shards);
        const counts = plan.shards.map((s) => s.tests.length);
        const maxCount = Math.max(...counts);
        const minCount = Math.min(...counts);
        expect(maxCount - minCount).toBeLessThanOrEqual(1);
      }),
      { numRuns: 100 },
    );
  });
});

describe('FileGroupStrategy — property-based tests', () => {
  const strategy = new FileGroupStrategy();

  /**
   * Generate tests that share files — some files have multiple tests.
   */
  const testListWithSharedFilesArb = fc
    .array(
      fc.stringMatching(/^[a-z]{1,5}\.spec\.ts$/),
      { minLength: 1, maxLength: 10 },
    )
    .chain((files) =>
      fc.array(
        fc.record({
          testId: fc.uuid(),
          file: fc.constantFrom(...files),
          estimatedDuration: fc.nat({ max: 60_000 }),
        }),
        { minLength: 1, maxLength: 50 },
      ),
    );

  it('should never split tests from the same file across shards', () => {
    fc.assert(
      fc.property(testListWithSharedFilesArb, shardCountArb, (tests, shards) => {
        const plan = strategy.balance(tests, shards);

        // Collect all assigned files per shard
        for (const shard of plan.shards) {
          // Each shard's tests are file names, check no file appears in multiple shards
          for (const file of shard.tests) {
            const otherShards = plan.shards.filter((s) => s !== shard);
            for (const other of otherShards) {
              expect(other.tests).not.toContain(file);
            }
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it('should account for all unique files', () => {
    fc.assert(
      fc.property(testListWithSharedFilesArb, shardCountArb, (tests, shards) => {
        const plan = strategy.balance(tests, shards);
        const uniqueInputFiles = new Set(tests.map((t) => t.file));
        const assignedFiles = new Set(plan.shards.flatMap((s) => s.tests));
        expect(assignedFiles).toEqual(uniqueInputFiles);
      }),
      { numRuns: 100 },
    );
  });
});
