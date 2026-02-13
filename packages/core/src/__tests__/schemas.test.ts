import { describe, expect, it } from 'vitest';

import {
  TestResultSchema,
  RunResultSchema,
  ShardPlanSchema,
  ShardTimingDataSchema,
  ReporterOptionsSchema,
  InitConfigSchema,
  TestHistorySchema,
} from '../schemas/index.js';

describe('TestResultSchema', () => {
  const validTestResult = {
    id: 'abc123',
    file: 'tests/login.spec.ts',
    title: 'should login',
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
  };

  it('should accept valid test result', () => {
    const result = TestResultSchema.safeParse(validTestResult);
    expect(result.success).toBe(true);
  });

  it('should accept all valid statuses', () => {
    for (const status of ['passed', 'failed', 'timedOut', 'skipped', 'interrupted']) {
      const result = TestResultSchema.safeParse({ ...validTestResult, status });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid status', () => {
    const result = TestResultSchema.safeParse({ ...validTestResult, status: 'unknown' });
    expect(result.success).toBe(false);
  });

  it('should reject empty id', () => {
    const result = TestResultSchema.safeParse({ ...validTestResult, id: '' });
    expect(result.success).toBe(false);
  });

  it('should reject negative duration', () => {
    const result = TestResultSchema.safeParse({ ...validTestResult, duration: -1 });
    expect(result.success).toBe(false);
  });

  it('should accept optional shardIndex', () => {
    const result = TestResultSchema.safeParse({ ...validTestResult, shardIndex: 1 });
    expect(result.success).toBe(true);
  });

  it('should reject shardIndex of 0 (must be positive)', () => {
    const result = TestResultSchema.safeParse({ ...validTestResult, shardIndex: 0 });
    expect(result.success).toBe(false);
  });

  it('should accept test result with errors', () => {
    const result = TestResultSchema.safeParse({
      ...validTestResult,
      status: 'failed',
      errors: [
        {
          message: 'Expected true to be false',
          stack: 'Error: Expected true to be false\n    at Object.<anonymous>',
          location: { file: 'tests/login.spec.ts', line: 10, column: 5 },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should accept test result with attachments', () => {
    const result = TestResultSchema.safeParse({
      ...validTestResult,
      attachments: [
        {
          name: 'screenshot',
          contentType: 'image/png',
          path: 'test-results/screenshot.png',
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('ShardPlanSchema', () => {
  const validPlan = {
    shards: [
      { shardIndex: 1, tests: ['a.spec.ts'], estimatedDuration: 5000 },
      { shardIndex: 2, tests: ['b.spec.ts'], estimatedDuration: 3000 },
    ],
    strategy: 'lpt',
    totalTests: 2,
    maxShardDuration: 5000,
    minShardDuration: 3000,
    generatedAt: '2024-01-15T10:00:00.000Z',
  };

  it('should accept valid shard plan', () => {
    const result = ShardPlanSchema.safeParse(validPlan);
    expect(result.success).toBe(true);
  });

  it('should accept all valid strategies', () => {
    for (const strategy of ['lpt', 'round-robin', 'file-group']) {
      const result = ShardPlanSchema.safeParse({ ...validPlan, strategy });
      expect(result.success).toBe(true);
    }
  });

  it('should accept optional improvement percentage', () => {
    const result = ShardPlanSchema.safeParse({ ...validPlan, improvement: 35.5 });
    expect(result.success).toBe(true);
  });
});

describe('ShardTimingDataSchema', () => {
  it('should accept valid timing data', () => {
    const result = ShardTimingDataSchema.safeParse({
      testId: 'abc123',
      file: 'tests/login.spec.ts',
      project: 'chromium',
      avgDuration: 5000,
      p95Duration: 7500,
      samples: 10,
    });
    expect(result.success).toBe(true);
  });

  it('should reject zero samples', () => {
    const result = ShardTimingDataSchema.safeParse({
      testId: 'abc123',
      file: 'tests/login.spec.ts',
      project: 'chromium',
      avgDuration: 5000,
      p95Duration: 7500,
      samples: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('ReporterOptionsSchema', () => {
  it('should apply defaults', () => {
    const result = ReporterOptionsSchema.parse({});
    expect(result.outputDir).toBe('.sorry-currents');
    expect(result.attachArtifacts).toBe(true);
    expect(result.artifactsDir).toBe('test-results');
    expect(result.silent).toBe(false);
  });

  it('should accept custom values', () => {
    const result = ReporterOptionsSchema.parse({
      outputDir: 'custom-dir',
      runId: 'run-42',
      attachArtifacts: false,
      artifactsDir: 'artifacts',
      silent: true,
    });
    expect(result.outputDir).toBe('custom-dir');
    expect(result.runId).toBe('run-42');
  });
});

describe('InitConfigSchema', () => {
  const validConfig = {
    ciProvider: 'github-actions',
    shardCount: 4,
    packageManager: 'pnpm',
    playwrightConfigPath: 'playwright.config.ts',
    installCommand: 'pnpm install',
    browserInstallCommand: 'npx playwright install --with-deps',
    testCommand: 'npx playwright test',
    branchFilters: ['main', 'master'],
    includeSlack: false,
    includeGitHubComment: true,
  };

  it('should accept valid init config', () => {
    const result = InitConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('should reject invalid CI provider', () => {
    const result = InitConfigSchema.safeParse({ ...validConfig, ciProvider: 'travis' });
    expect(result.success).toBe(false);
  });
});

describe('TestHistorySchema', () => {
  it('should accept valid test history', () => {
    const result = TestHistorySchema.safeParse({
      id: 'test-1',
      title: 'should login',
      file: 'tests/login.spec.ts',
      project: 'chromium',
      totalRuns: 50,
      passCount: 45,
      failCount: 3,
      flakyCount: 2,
      skipCount: 0,
      avgDuration: 5000,
      p95Duration: 7500,
      lastDurations: [5000, 4800, 5200],
      flakinessRate: 0.04,
      failureRate: 0.06,
      lastSeen: '2024-01-15T10:00:00.000Z',
      topErrors: [
        {
          message: 'Timeout',
          count: 3,
          lastSeen: '2024-01-15T10:00:00.000Z',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should reject flakinessRate above 1', () => {
    const result = TestHistorySchema.safeParse({
      id: 'test-1',
      title: 'test',
      file: 'f.ts',
      project: '',
      totalRuns: 1,
      passCount: 1,
      failCount: 0,
      flakyCount: 0,
      skipCount: 0,
      avgDuration: 100,
      p95Duration: 100,
      lastDurations: [],
      flakinessRate: 1.5,
      failureRate: 0,
      lastSeen: '2024-01-15T10:00:00.000Z',
      topErrors: [],
    });
    expect(result.success).toBe(false);
  });
});
