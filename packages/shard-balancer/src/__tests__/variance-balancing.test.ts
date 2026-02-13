/** Tests for variance-aware shard balancing: computePessimisticDuration and timingDataToEntries with riskFactor. */
import { describe, expect, it } from 'vitest';

import {
  computePessimisticDuration,
  timingDataToEntries,
  LPTStrategy,
} from '../index.js';

import type { ShardTimingData } from '@sorry-currents/core';

// --- computePessimisticDuration ---

describe('computePessimisticDuration', () => {
  it('should return avg when riskFactor is 0', () => {
    expect(computePessimisticDuration(5000, 1000, 0)).toBe(5000);
  });

  it('should return avg when stdDev is 0', () => {
    expect(computePessimisticDuration(5000, 0, 1)).toBe(5000);
  });

  it('should return avg when stdDev is undefined', () => {
    expect(computePessimisticDuration(5000, undefined, 1)).toBe(5000);
  });

  it('should return avg + 1*stdDev when riskFactor is 1', () => {
    expect(computePessimisticDuration(5000, 1000, 1)).toBe(6000);
  });

  it('should return avg + 2*stdDev when riskFactor is 2', () => {
    expect(computePessimisticDuration(5000, 1000, 2)).toBe(7000);
  });

  it('should return avg for negative riskFactor', () => {
    expect(computePessimisticDuration(5000, 1000, -1)).toBe(5000);
  });

  it('should handle fractional riskFactor', () => {
    // 5000 + 0.5 * 1000 = 5500
    expect(computePessimisticDuration(5000, 1000, 0.5)).toBe(5500);
  });

  it('should round result to integer', () => {
    // 5000 + 1 * 333 = 5333
    expect(computePessimisticDuration(5000, 333, 1)).toBe(5333);
  });
});

// --- timingDataToEntries with riskFactor ---

describe('timingDataToEntries with riskFactor', () => {
  const sampleData: ShardTimingData[] = [
    { testId: 't1', file: 'a.spec.ts', project: 'default', avgDuration: 5000, p95Duration: 7000, samples: 10, stdDev: 1000, lastDurations: [4000, 5000, 6000] },
    { testId: 't2', file: 'b.spec.ts', project: 'default', avgDuration: 3000, p95Duration: 4000, samples: 5, stdDev: 500, lastDurations: [2500, 3500] },
    { testId: 't3', file: 'c.spec.ts', project: 'default', avgDuration: 2000, p95Duration: 2500, samples: 3, stdDev: 0, lastDurations: [2000, 2000] },
  ];

  it('should use avgDuration without padding when riskFactor is 0', () => {
    const entries = timingDataToEntries(sampleData, 10000, 0);

    expect(entries[0]!.estimatedDuration).toBe(5000);
    expect(entries[1]!.estimatedDuration).toBe(3000);
    expect(entries[2]!.estimatedDuration).toBe(2000);
  });

  it('should apply pessimistic padding when riskFactor is 1', () => {
    const entries = timingDataToEntries(sampleData, 10000, 1);

    // t1: 5000 + 1*1000 = 6000
    expect(entries[0]!.estimatedDuration).toBe(6000);
    // t2: 3000 + 1*500 = 3500
    expect(entries[1]!.estimatedDuration).toBe(3500);
    // t3: stdDev=0 → no padding → 2000
    expect(entries[2]!.estimatedDuration).toBe(2000);
  });

  it('should apply double padding when riskFactor is 2', () => {
    const entries = timingDataToEntries(sampleData, 10000, 2);

    // t1: 5000 + 2*1000 = 7000
    expect(entries[0]!.estimatedDuration).toBe(7000);
    // t2: 3000 + 2*500 = 4000
    expect(entries[1]!.estimatedDuration).toBe(4000);
    // t3: stdDev=0 → 2000
    expect(entries[2]!.estimatedDuration).toBe(2000);
  });

  it('should include stdDev in output entries', () => {
    const entries = timingDataToEntries(sampleData, 10000, 1);

    expect(entries[0]!.stdDev).toBe(1000);
    expect(entries[1]!.stdDev).toBe(500);
    expect(entries[2]!.stdDev).toBe(0);
  });

  it('should use defaultDuration for tests with 0 avgDuration', () => {
    const data: ShardTimingData[] = [
      { testId: 't1', file: 'a.spec.ts', project: 'default', avgDuration: 0, p95Duration: 0, samples: 1, stdDev: 0, lastDurations: [] },
    ];
    const entries = timingDataToEntries(data, 10000, 1);

    expect(entries[0]!.estimatedDuration).toBe(10000);
  });

  it('should default riskFactor to 0 when not provided', () => {
    const entries = timingDataToEntries(sampleData, 10000);

    // No padding — same as riskFactor=0
    expect(entries[0]!.estimatedDuration).toBe(5000);
  });
});

// --- LPT with variance-padded entries ---

describe('LPT with variance-padded entries', () => {
  it('should produce better balance when high-variance tests are padded', () => {
    const strategy = new LPTStrategy();

    // Without padding: t1=5000, t2=3000, t3=2000
    // File a.spec.ts=5000, b.spec.ts=3000, c.spec.ts=2000
    // With padding (k=1): t1=6000, t2=3500, t3=2000
    // Padding changes the allocation to account for variance

    const entriesNoPadding = timingDataToEntries([
      { testId: 't1', file: 'a.spec.ts', project: 'default', avgDuration: 5000, p95Duration: 7000, samples: 10, stdDev: 1000, lastDurations: [] },
      { testId: 't2', file: 'b.spec.ts', project: 'default', avgDuration: 3000, p95Duration: 4000, samples: 5, stdDev: 500, lastDurations: [] },
      { testId: 't3', file: 'c.spec.ts', project: 'default', avgDuration: 2000, p95Duration: 2500, samples: 3, stdDev: 0, lastDurations: [] },
    ], 10000, 0);

    const entriesWithPadding = timingDataToEntries([
      { testId: 't1', file: 'a.spec.ts', project: 'default', avgDuration: 5000, p95Duration: 7000, samples: 10, stdDev: 1000, lastDurations: [] },
      { testId: 't2', file: 'b.spec.ts', project: 'default', avgDuration: 3000, p95Duration: 4000, samples: 5, stdDev: 500, lastDurations: [] },
      { testId: 't3', file: 'c.spec.ts', project: 'default', avgDuration: 2000, p95Duration: 2500, samples: 3, stdDev: 0, lastDurations: [] },
    ], 10000, 1);

    const planNoPadding = strategy.balance(entriesNoPadding, 2);
    const planWithPadding = strategy.balance(entriesWithPadding, 2);

    // Both should produce valid plans
    expect(planNoPadding.totalTests).toBe(3);
    expect(planWithPadding.totalTests).toBe(3);

    // Padded plan should have higher maxShardDuration (reflects variance budget)
    expect(planWithPadding.maxShardDuration).toBeGreaterThanOrEqual(planNoPadding.maxShardDuration);
  });
});
