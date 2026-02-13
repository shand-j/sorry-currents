import { describe, expect, it } from 'vitest';

import type { RunResult } from '../schemas/run-result.js';
import { mergeRunResults } from '../utils/merge-run-results.js';

function createShardResult(overrides: Partial<RunResult> = {}): RunResult {
  return {
    id: 'run-123',
    timestamp: '2024-01-15T10:00:00.000Z',
    duration: 10_000,
    status: 'passed',
    totalTests: 2,
    passedTests: 2,
    failedTests: 0,
    skippedTests: 0,
    flakyTests: 0,
    shardCount: 2,
    shardIndex: 1,
    tests: [
      {
        id: 'test-1',
        file: 'tests/a.spec.ts',
        title: 'test a',
        project: 'chromium',
        status: 'passed',
        duration: 5000,
        retries: 0,
        isFlaky: false,
        errors: [],
        annotations: [],
        tags: [],
        attachments: [],
        startedAt: '2024-01-15T10:00:00.000Z',
        workerId: 0,
        shardIndex: 1,
      },
    ],
    environment: {
      os: 'linux',
      nodeVersion: '20.0.0',
      playwrightVersion: '1.40.0',
      ci: 'github-actions',
    },
    git: {
      branch: 'main',
      commit: 'abc123',
      commitMessage: 'test commit',
      author: 'dev',
    },
    config: {
      workers: 4,
      projects: ['chromium'],
      retries: 1,
      timeout: 30_000,
    },
    ...overrides,
  };
}

describe('mergeRunResults', () => {
  it('should merge two passing shard results', () => {
    const shard1 = createShardResult({ shardIndex: 1 });
    const shard2 = createShardResult({
      shardIndex: 2,
      tests: [
        {
          id: 'test-2',
          file: 'tests/b.spec.ts',
          title: 'test b',
          project: 'chromium',
          status: 'passed',
          duration: 3000,
          retries: 0,
          isFlaky: false,
          errors: [],
          annotations: [],
          tags: [],
          attachments: [],
          startedAt: '2024-01-15T10:00:01.000Z',
          workerId: 0,
          shardIndex: 2,
        },
      ],
    });

    const result = mergeRunResults([shard1, shard2]);

    expect(result.totalTests).toBe(2);
    expect(result.passedTests).toBe(2);
    expect(result.failedTests).toBe(0);
    expect(result.status).toBe('passed');
    expect(result.shardCount).toBe(2);
    expect(result.tests).toHaveLength(2);
  });

  it('should resolve status to failed when any shard failed', () => {
    const shard1 = createShardResult({ status: 'passed' });
    const shard2 = createShardResult({ status: 'failed' });

    const result = mergeRunResults([shard1, shard2]);
    expect(result.status).toBe('failed');
  });

  it('should resolve status to interrupted over failed', () => {
    const shard1 = createShardResult({ status: 'failed' });
    const shard2 = createShardResult({ status: 'interrupted' });

    const result = mergeRunResults([shard1, shard2]);
    expect(result.status).toBe('interrupted');
  });

  it('should resolve status to timedOut over failed', () => {
    const shard1 = createShardResult({ status: 'failed' });
    const shard2 = createShardResult({ status: 'timedOut' });

    const result = mergeRunResults([shard1, shard2]);
    expect(result.status).toBe('timedOut');
  });

  it('should use the maximum duration across shards', () => {
    const shard1 = createShardResult({ duration: 5000 });
    const shard2 = createShardResult({ duration: 12000 });

    const result = mergeRunResults([shard1, shard2]);
    expect(result.duration).toBe(12000);
  });

  it('should count flaky tests correctly', () => {
    const shard1 = createShardResult({
      tests: [
        {
          id: 'test-flaky',
          file: 'tests/flaky.spec.ts',
          title: 'flaky test',
          project: 'chromium',
          status: 'passed',
          duration: 5000,
          retries: 2,
          isFlaky: true,
          errors: [],
          annotations: [],
          tags: [],
          attachments: [],
          startedAt: '2024-01-15T10:00:00.000Z',
          workerId: 0,
        },
      ],
    });

    const result = mergeRunResults([shard1]);
    expect(result.flakyTests).toBe(1);
  });

  it('should throw when given zero results', () => {
    expect(() => mergeRunResults([])).toThrow('Cannot merge zero RunResults');
  });

  it('should handle single shard result', () => {
    const shard = createShardResult();
    const result = mergeRunResults([shard]);
    expect(result.totalTests).toBe(1);
    expect(result.shardCount).toBe(1);
  });
});
