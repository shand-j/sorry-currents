/** Tests for variance-aware shard balancing: computeStdDev and updateTimingData variance tracking. */
import { describe, expect, it } from 'vitest';

import {
  computeStdDev,
  updateTimingData,
  MAX_DURATION_WINDOW,
  type ShardTimingData,
  type TestResult,
} from '../index.js';

// --- Test helpers ---

const makeTestResult = (overrides: Partial<TestResult> & { id: string; file: string }): TestResult => ({
  id: overrides.id,
  file: overrides.file,
  title: overrides.title ?? 'test title',
  project: overrides.project ?? 'default',
  status: overrides.status ?? 'passed',
  duration: overrides.duration ?? 1000,
  retries: overrides.retries ?? 0,
  isFlaky: overrides.isFlaky ?? false,
  errors: overrides.errors ?? [],
  annotations: overrides.annotations ?? [],
  tags: overrides.tags ?? [],
  attachments: overrides.attachments ?? [],
  startedAt: overrides.startedAt ?? new Date().toISOString(),
  workerId: overrides.workerId ?? 0,
  shardIndex: overrides.shardIndex,
});

// --- computeStdDev ---

describe('computeStdDev', () => {
  it('should return 0 for empty array', () => {
    expect(computeStdDev([])).toBe(0);
  });

  it('should return 0 for single element', () => {
    expect(computeStdDev([5000])).toBe(0);
  });

  it('should return 0 for uniform values', () => {
    expect(computeStdDev([100, 100, 100, 100])).toBe(0);
  });

  it('should compute population stdDev for known values', () => {
    // [2, 4, 4, 4, 5, 5, 7, 9] → mean=5, variance=4, stddev=2
    expect(computeStdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
  });

  it('should compute correct stdDev for two values', () => {
    // [3000, 5000] → mean=4000, variance=1000000, stddev=1000
    expect(computeStdDev([3000, 5000])).toBe(1000);
  });

  it('should round to integer milliseconds', () => {
    // [1, 2, 3] → mean=2, variance=(1+0+1)/3=0.6667, stddev=0.8165 → rounds to 1
    expect(computeStdDev([1, 2, 3])).toBe(1);
  });

  it('should handle large duration arrays', () => {
    const durations = Array.from({ length: 100 }, (_, i) => i * 100);
    const result = computeStdDev(durations);
    expect(result).toBeGreaterThan(0);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('should treat input as readonly — no mutation', () => {
    const input = [1000, 2000, 3000] as const;
    computeStdDev(input);
    expect(input).toEqual([1000, 2000, 3000]);
  });
});

// --- updateTimingData variance tracking ---

describe('updateTimingData variance tracking', () => {
  it('should initialize lastDurations with single entry for new tests', () => {
    const results: TestResult[] = [
      makeTestResult({ id: 't1', file: 'a.spec.ts', duration: 5000 }),
    ];

    const updated = updateTimingData([], results);

    expect(updated[0]!.lastDurations).toEqual([5000]);
    expect(updated[0]!.stdDev).toBe(0);
  });

  it('should accumulate durations in lastDurations window', () => {
    const existing: ShardTimingData[] = [
      { testId: 't1', file: 'a.spec.ts', project: 'default', avgDuration: 1000, p95Duration: 1200, samples: 1, stdDev: 0, lastDurations: [1000] },
    ];
    const results: TestResult[] = [
      makeTestResult({ id: 't1', file: 'a.spec.ts', duration: 2000 }),
    ];

    const updated = updateTimingData(existing, results);

    expect(updated[0]!.lastDurations).toEqual([1000, 2000]);
    expect(updated[0]!.stdDev).toBe(500); // stddev([1000, 2000]) = 500
  });

  it('should evict oldest durations when window exceeds MAX_DURATION_WINDOW', () => {
    // Fill window to capacity
    const fullDurations = Array.from({ length: MAX_DURATION_WINDOW }, (_, i) => 1000 + i * 10);
    const existing: ShardTimingData[] = [
      { testId: 't1', file: 'a.spec.ts', project: 'default', avgDuration: 1100, p95Duration: 1200, samples: MAX_DURATION_WINDOW, stdDev: 100, lastDurations: fullDurations },
    ];
    const results: TestResult[] = [
      makeTestResult({ id: 't1', file: 'a.spec.ts', duration: 9999 }),
    ];

    const updated = updateTimingData(existing, results);

    // Window should still be MAX_DURATION_WINDOW elements (FIFO eviction)
    expect(updated[0]!.lastDurations).toHaveLength(MAX_DURATION_WINDOW);
    // Oldest entry (1000) should be evicted, newest (9999) appended
    expect(updated[0]!.lastDurations[0]).toBe(1010); // second-oldest becomes first
    expect(updated[0]!.lastDurations[MAX_DURATION_WINDOW - 1]).toBe(9999);
  });

  it('should compute stdDev from lastDurations window', () => {
    const existing: ShardTimingData[] = [
      { testId: 't1', file: 'a.spec.ts', project: 'default', avgDuration: 3000, p95Duration: 5000, samples: 3, stdDev: 0, lastDurations: [2000, 3000, 4000] },
    ];
    const results: TestResult[] = [
      makeTestResult({ id: 't1', file: 'a.spec.ts', duration: 5000 }),
    ];

    const updated = updateTimingData(existing, results);

    // lastDurations: [2000, 3000, 4000, 5000] → mean=3500, stddev≈1118
    expect(updated[0]!.lastDurations).toEqual([2000, 3000, 4000, 5000]);
    expect(updated[0]!.stdDev).toBe(computeStdDev([2000, 3000, 4000, 5000]));
  });

  it('should handle existing data without lastDurations (v1 migration)', () => {
    // Simulate v1 data parsed through Zod (defaults applied)
    const existing: ShardTimingData[] = [
      { testId: 't1', file: 'a.spec.ts', project: 'default', avgDuration: 5000, p95Duration: 7000, samples: 10, stdDev: 0, lastDurations: [] },
    ];
    const results: TestResult[] = [
      makeTestResult({ id: 't1', file: 'a.spec.ts', duration: 6000 }),
    ];

    const updated = updateTimingData(existing, results);

    // Should start building the window from the empty state
    expect(updated[0]!.lastDurations).toEqual([6000]);
    expect(updated[0]!.stdDev).toBe(0); // Single entry → 0 stdDev
  });

  it('should preserve variance data for tests not in new results', () => {
    const existing: ShardTimingData[] = [
      { testId: 't1', file: 'a.spec.ts', project: 'default', avgDuration: 1000, p95Duration: 1200, samples: 5, stdDev: 200, lastDurations: [800, 1000, 1200] },
      { testId: 't2', file: 'b.spec.ts', project: 'default', avgDuration: 2000, p95Duration: 2500, samples: 3, stdDev: 100, lastDurations: [1900, 2100] },
    ];
    const results: TestResult[] = [
      makeTestResult({ id: 't1', file: 'a.spec.ts', duration: 1100 }),
    ];

    const updated = updateTimingData(existing, results);

    // t2 should be unchanged
    const t2 = updated.find((t) => t.testId === 't2')!;
    expect(t2.stdDev).toBe(100);
    expect(t2.lastDurations).toEqual([1900, 2100]);
  });
});
