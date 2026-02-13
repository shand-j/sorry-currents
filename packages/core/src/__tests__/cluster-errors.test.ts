import { describe, expect, it } from 'vitest';

import { clusterErrors, clustersToSummaries, type TestResult } from '../index.js';

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

describe('clusterErrors', () => {
  it('should return empty array for all-passing tests', () => {
    const results = [
      makeTestResult({ id: 'test1', file: 'a.spec.ts', status: 'passed' }),
    ];
    const clusters = clusterErrors(results);
    expect(clusters).toEqual([]);
  });

  it('should group tests with the same error message', () => {
    const results = [
      makeTestResult({
        id: 'test1', file: 'a.spec.ts', status: 'failed',
        errors: [{ message: 'Expected true to be false' }],
      }),
      makeTestResult({
        id: 'test2', file: 'b.spec.ts', status: 'failed',
        errors: [{ message: 'Expected true to be false' }],
      }),
    ];
    const clusters = clusterErrors(results);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.count).toBe(2);
    expect(clusters[0]!.testIds).toContain('test1');
    expect(clusters[0]!.testIds).toContain('test2');
    expect(clusters[0]!.files).toContain('a.spec.ts');
    expect(clusters[0]!.files).toContain('b.spec.ts');
  });

  it('should normalize errors before grouping', () => {
    const results = [
      makeTestResult({
        id: 'test1', file: 'a.spec.ts', status: 'failed',
        errors: [{ message: 'Error at 2025-01-01T00:00:00Z in file' }],
      }),
      makeTestResult({
        id: 'test2', file: 'b.spec.ts', status: 'failed',
        errors: [{ message: 'Error at 2026-02-13T12:34:56Z in file' }],
      }),
    ];
    const clusters = clusterErrors(results);

    // Both should normalize to the same message (timestamps replaced)
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.count).toBe(2);
  });

  it('should create separate clusters for different errors', () => {
    const results = [
      makeTestResult({
        id: 'test1', file: 'a.spec.ts', status: 'failed',
        errors: [{ message: 'Expected true to be false' }],
      }),
      makeTestResult({
        id: 'test2', file: 'b.spec.ts', status: 'failed',
        errors: [{ message: 'Timeout waiting for element' }],
      }),
    ];
    const clusters = clusterErrors(results);

    expect(clusters).toHaveLength(2);
  });

  it('should sort clusters by count descending', () => {
    const results = [
      makeTestResult({ id: 'test1', file: 'a.spec.ts', status: 'failed', errors: [{ message: 'Error A' }] }),
      makeTestResult({ id: 'test2', file: 'b.spec.ts', status: 'failed', errors: [{ message: 'Error B' }] }),
      makeTestResult({ id: 'test3', file: 'c.spec.ts', status: 'failed', errors: [{ message: 'Error B' }] }),
      makeTestResult({ id: 'test4', file: 'd.spec.ts', status: 'failed', errors: [{ message: 'Error B' }] }),
    ];
    const clusters = clusterErrors(results);

    expect(clusters[0]!.message).toBe('Error B');
    expect(clusters[0]!.count).toBe(3);
    expect(clusters[1]!.message).toBe('Error A');
    expect(clusters[1]!.count).toBe(1);
  });

  it('should include timedOut tests', () => {
    const results = [
      makeTestResult({
        id: 'test1', file: 'a.spec.ts', status: 'timedOut',
        errors: [{ message: 'Test timed out' }],
      }),
    ];
    const clusters = clusterErrors(results);
    expect(clusters).toHaveLength(1);
  });

  it('should skip passed and skipped tests', () => {
    const results = [
      makeTestResult({ id: 'test1', file: 'a.spec.ts', status: 'passed', errors: [] }),
      makeTestResult({ id: 'test2', file: 'b.spec.ts', status: 'skipped', errors: [] }),
    ];
    const clusters = clusterErrors(results);
    expect(clusters).toEqual([]);
  });

  it('should preserve example stack trace', () => {
    const results = [
      makeTestResult({
        id: 'test1', file: 'a.spec.ts', status: 'failed',
        errors: [{ message: 'Error A', stack: 'at test.ts:10\nat runner.ts:20' }],
      }),
    ];
    const clusters = clusterErrors(results);
    expect(clusters[0]!.exampleStack).toContain('at test.ts:10');
  });

  it('should handle tests with multiple errors', () => {
    const results = [
      makeTestResult({
        id: 'test1', file: 'a.spec.ts', status: 'failed',
        errors: [
          { message: 'Error A' },
          { message: 'Error B' },
        ],
      }),
    ];
    const clusters = clusterErrors(results);
    expect(clusters).toHaveLength(2);
  });
});

describe('clustersToSummaries', () => {
  it('should convert clusters to ErrorSummary format', () => {
    const clusters = [
      { message: 'Error A', count: 3, testIds: ['t1', 't2', 't3'], files: ['a.spec.ts'], exampleStack: 'stack' },
    ];
    const summaries = clustersToSummaries(clusters);

    expect(summaries).toHaveLength(1);
    expect(summaries[0]!.message).toBe('Error A');
    expect(summaries[0]!.count).toBe(3);
    expect(summaries[0]!.lastSeen).toBeDefined();
    expect(summaries[0]!.exampleStack).toBe('stack');
  });

  it('should respect limit parameter', () => {
    const clusters = Array.from({ length: 20 }, (_, i) => ({
      message: `Error ${i}`,
      count: 20 - i,
      testIds: [`t${i}`],
      files: [`f${i}.spec.ts`],
    }));
    const summaries = clustersToSummaries(clusters, 5);
    expect(summaries).toHaveLength(5);
  });

  it('should handle empty input', () => {
    const summaries = clustersToSummaries([]);
    expect(summaries).toEqual([]);
  });
});
