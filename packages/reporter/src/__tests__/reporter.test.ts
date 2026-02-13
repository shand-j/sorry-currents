import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import SorryCurrentsReporter from '../index.js';

/**
 * Minimal mocks for Playwright Reporter API types.
 * We mock just enough to exercise the reporter's data flow.
 */

function makeFullConfig(overrides: Record<string, unknown> = {}): any {
  return {
    rootDir: '/project',
    workers: 4,
    version: '1.40.0',
    projects: [{ name: 'default', timeout: 30_000 }],
    shard: null,
    ...overrides,
  };
}

function makeSuite(testCount = 5): any {
  return {
    allTests: () => Array.from({ length: testCount }, (_, i) => ({ id: `t${i}` })),
  };
}

function makeTestCase(overrides: Record<string, unknown> = {}): any {
  return {
    title: 'should work',
    titlePath: () => ['describe', 'should work'],
    location: { file: '/project/tests/example.spec.ts', line: 10, column: 5 },
    parent: { project: () => ({ name: 'default' }) },
    annotations: [],
    tags: [],
    ...overrides,
  };
}

function makePWTestResult(overrides: Record<string, unknown> = {}): any {
  return {
    status: 'passed',
    duration: 1500,
    retry: 0,
    errors: [],
    attachments: [],
    startTime: new Date('2025-01-15T10:00:00.000Z'),
    workerIndex: 0,
    ...overrides,
  };
}

function makeFullResult(overrides: Record<string, unknown> = {}): any {
  return {
    status: 'passed',
    duration: 30_000,
    ...overrides,
  };
}

describe('SorryCurrentsReporter', () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = await mkdtemp(join(tmpdir(), 'sorry-currents-test-'));
  });

  afterEach(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  it('should create output directories on begin', () => {
    const reporter = new SorryCurrentsReporter({ outputDir, silent: true });
    reporter.onBegin(makeFullConfig(), makeSuite());
    // No error thrown means success — dirs are created async fire-and-forget
  });

  it('should write run-result.json on end', async () => {
    const reporter = new SorryCurrentsReporter({ outputDir, silent: true });
    reporter.onBegin(makeFullConfig(), makeSuite());

    reporter.onTestEnd(makeTestCase(), makePWTestResult());
    await reporter.onEnd(makeFullResult());

    // Find the run-result.json
    const runsDir = join(outputDir, 'runs');
    const runs = await readdir(runsDir);
    expect(runs.length).toBe(1);

    const runDir = join(runsDir, runs[0]!);
    const resultFile = join(runDir, 'run-result.json');
    const raw = await readFile(resultFile, 'utf-8');
    const result = JSON.parse(raw);

    expect(result.totalTests).toBe(1);
    expect(result.status).toBe('passed');
    expect(result.environment.playwrightVersion).toBe('1.40.0');
  });

  describe('status mapping (Bug #1 fix)', () => {
    it('should map Playwright "timedout" to schema "timedOut" for test status', async () => {
      const reporter = new SorryCurrentsReporter({ outputDir, silent: true });
      reporter.onBegin(makeFullConfig(), makeSuite());

      reporter.onTestEnd(
        makeTestCase(),
        makePWTestResult({ status: 'timedout' }),
      );
      await reporter.onEnd(makeFullResult());

      const runsDir = join(outputDir, 'runs');
      const runs = await readdir(runsDir);
      const runDir = join(runsDir, runs[0]!);
      const raw = await readFile(join(runDir, 'run-result.json'), 'utf-8');
      const result = JSON.parse(raw);

      expect(result.tests[0].status).toBe('timedOut');
    });

    it('should map Playwright "timedout" to "timedOut" for run status', async () => {
      const reporter = new SorryCurrentsReporter({ outputDir, silent: true });
      reporter.onBegin(makeFullConfig(), makeSuite());
      reporter.onTestEnd(makeTestCase(), makePWTestResult());
      await reporter.onEnd(makeFullResult({ status: 'timedout' }));

      const runsDir = join(outputDir, 'runs');
      const runs = await readdir(runsDir);
      const runDir = join(runsDir, runs[0]!);
      const raw = await readFile(join(runDir, 'run-result.json'), 'utf-8');
      const result = JSON.parse(raw);

      expect(result.status).toBe('timedOut');
    });

    it('should handle standard statuses correctly', async () => {
      const reporter = new SorryCurrentsReporter({ outputDir, silent: true });
      reporter.onBegin(makeFullConfig(), makeSuite());

      reporter.onTestEnd(makeTestCase(), makePWTestResult({ status: 'passed' }));
      reporter.onTestEnd(
        makeTestCase({ title: 'fails', titlePath: () => ['fails'] }),
        makePWTestResult({ status: 'failed', errors: [{ message: 'Oops' }] }),
      );
      reporter.onTestEnd(
        makeTestCase({ title: 'skipped', titlePath: () => ['skipped'] }),
        makePWTestResult({ status: 'skipped' }),
      );
      await reporter.onEnd(makeFullResult());

      const runsDir = join(outputDir, 'runs');
      const runs = await readdir(runsDir);
      const runDir = join(runsDir, runs[0]!);
      const raw = await readFile(join(runDir, 'run-result.json'), 'utf-8');
      const result = JSON.parse(raw);

      const statuses = result.tests.map((t: any) => t.status);
      expect(statuses).toContain('passed');
      expect(statuses).toContain('failed');
      expect(statuses).toContain('skipped');
    });
  });

  describe('retry deduplication (Bug #2 fix)', () => {
    it('should keep only the final retry attempt per test', async () => {
      const reporter = new SorryCurrentsReporter({ outputDir, silent: true });
      reporter.onBegin(makeFullConfig(), makeSuite());

      const test = makeTestCase();

      // Simulate Playwright calling onTestEnd for each retry attempt
      // Attempt 0: failed
      reporter.onTestEnd(test, makePWTestResult({ status: 'failed', retry: 0, errors: [{ message: 'first fail' }] }));
      // Attempt 1: failed
      reporter.onTestEnd(test, makePWTestResult({ status: 'failed', retry: 1, errors: [{ message: 'second fail' }] }));
      // Attempt 2: passed (final)
      reporter.onTestEnd(test, makePWTestResult({ status: 'passed', retry: 2 }));

      await reporter.onEnd(makeFullResult());

      const runsDir = join(outputDir, 'runs');
      const runs = await readdir(runsDir);
      const runDir = join(runsDir, runs[0]!);
      const raw = await readFile(join(runDir, 'run-result.json'), 'utf-8');
      const result = JSON.parse(raw);

      // Should have exactly 1 test, not 3
      expect(result.totalTests).toBe(1);
      expect(result.tests[0].status).toBe('passed');
      expect(result.tests[0].retries).toBe(2);
    });

    it('should not inflate test counts with retries', async () => {
      const reporter = new SorryCurrentsReporter({ outputDir, silent: true });
      reporter.onBegin(makeFullConfig(), makeSuite());

      const test1 = makeTestCase({ title: 'test one', titlePath: () => ['test one'] });
      const test2 = makeTestCase({ title: 'test two', titlePath: () => ['test two'], location: { file: '/project/tests/other.spec.ts', line: 1, column: 1 } });

      // test1: 3 attempts
      reporter.onTestEnd(test1, makePWTestResult({ status: 'failed', retry: 0 }));
      reporter.onTestEnd(test1, makePWTestResult({ status: 'failed', retry: 1 }));
      reporter.onTestEnd(test1, makePWTestResult({ status: 'passed', retry: 2 }));

      // test2: 1 attempt
      reporter.onTestEnd(test2, makePWTestResult({ status: 'passed', retry: 0 }));

      await reporter.onEnd(makeFullResult());

      const runsDir = join(outputDir, 'runs');
      const runs = await readdir(runsDir);
      const runDir = join(runsDir, runs[0]!);
      const raw = await readFile(join(runDir, 'run-result.json'), 'utf-8');
      const result = JSON.parse(raw);

      expect(result.totalTests).toBe(2);
      expect(result.passedTests).toBe(1); // test2 passed, test1 is flaky
    });

    it('should mark test as flaky when it passes after retry', async () => {
      const reporter = new SorryCurrentsReporter({ outputDir, silent: true });
      reporter.onBegin(makeFullConfig(), makeSuite());

      const test = makeTestCase();

      reporter.onTestEnd(test, makePWTestResult({ status: 'failed', retry: 0 }));
      reporter.onTestEnd(test, makePWTestResult({ status: 'passed', retry: 1 }));

      await reporter.onEnd(makeFullResult());

      const runsDir = join(outputDir, 'runs');
      const runs = await readdir(runsDir);
      const runDir = join(runsDir, runs[0]!);
      const raw = await readFile(join(runDir, 'run-result.json'), 'utf-8');
      const result = JSON.parse(raw);

      expect(result.tests[0].isFlaky).toBe(true);
      expect(result.flakyTests).toBe(1);
    });
  });

  describe('SORRY_CURRENTS_RUN_ID env var (Bug #5 fix)', () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should use SORRY_CURRENTS_RUN_ID when set', async () => {
      process.env = { ...originalEnv, SORRY_CURRENTS_RUN_ID: 'custom-run-42' };

      const reporter = new SorryCurrentsReporter({ outputDir, silent: true });
      reporter.onBegin(makeFullConfig(), makeSuite());
      reporter.onTestEnd(makeTestCase(), makePWTestResult());
      await reporter.onEnd(makeFullResult());

      const runsDir = join(outputDir, 'runs');
      const runs = await readdir(runsDir);
      expect(runs).toContain('custom-run-42');
    });

    it('should prefer SORRY_CURRENTS_RUN_ID over GITHUB_RUN_ID', async () => {
      process.env = {
        ...originalEnv,
        SORRY_CURRENTS_RUN_ID: 'sc-run-1',
        GITHUB_RUN_ID: 'gh-run-2',
      };

      const reporter = new SorryCurrentsReporter({ outputDir, silent: true });
      reporter.onBegin(makeFullConfig(), makeSuite());
      reporter.onTestEnd(makeTestCase(), makePWTestResult());
      await reporter.onEnd(makeFullResult());

      const runsDir = join(outputDir, 'runs');
      const runs = await readdir(runsDir);
      expect(runs).toContain('sc-run-1');
      expect(runs).not.toContain('gh-run-2');
    });
  });

  describe('printsToStdio', () => {
    it('should return false', () => {
      const reporter = new SorryCurrentsReporter({ outputDir, silent: true });
      expect(reporter.printsToStdio()).toBe(false);
    });
  });

  describe('crash resilience', () => {
    it('should not throw when onTestEnd encounters an error', () => {
      const reporter = new SorryCurrentsReporter({ outputDir, silent: true });
      reporter.onBegin(makeFullConfig(), makeSuite());

      // Pass null to cause an internal error — reporter should swallow it
      expect(() => {
        reporter.onTestEnd(null as any, null as any);
      }).not.toThrow();
    });
  });

  describe('shard awareness', () => {
    it('should write shard-specific file when config has shard info', async () => {
      const reporter = new SorryCurrentsReporter({ outputDir, silent: true });
      reporter.onBegin(
        makeFullConfig({ shard: { current: 2, total: 4 } }),
        makeSuite(),
      );
      reporter.onTestEnd(makeTestCase(), makePWTestResult());
      await reporter.onEnd(makeFullResult());

      const runsDir = join(outputDir, 'runs');
      const runs = await readdir(runsDir);
      const runDir = join(runsDir, runs[0]!);
      const files = await readdir(runDir);

      expect(files).toContain('shard-2-of-4.json');
      expect(files).toContain('run-result.json');
    });

    it('should include shardIndex in test results when sharded', async () => {
      const reporter = new SorryCurrentsReporter({ outputDir, silent: true });
      reporter.onBegin(
        makeFullConfig({ shard: { current: 3, total: 5 } }),
        makeSuite(),
      );
      reporter.onTestEnd(makeTestCase(), makePWTestResult());
      await reporter.onEnd(makeFullResult());

      const runsDir = join(outputDir, 'runs');
      const runs = await readdir(runsDir);
      const runDir = join(runsDir, runs[0]!);
      const raw = await readFile(join(runDir, 'run-result.json'), 'utf-8');
      const result = JSON.parse(raw);

      expect(result.tests[0].shardIndex).toBe(3);
      expect(result.shardIndex).toBe(3);
      expect(result.shardCount).toBe(5);
    });
  });
});
