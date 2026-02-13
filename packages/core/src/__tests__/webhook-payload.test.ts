import { describe, expect, it } from 'vitest';

import { buildWebhookPayload } from '../notifications/webhook.js';
import type { RunResult } from '../schemas/index.js';

function makeRunResult(overrides: Partial<RunResult> = {}): RunResult {
  return {
    id: 'run-1',
    timestamp: '2025-01-15T10:00:00.000Z',
    duration: 272_000,
    status: 'passed',
    totalTests: 487,
    passedTests: 479,
    failedTests: 3,
    skippedTests: 0,
    flakyTests: 5,
    shardCount: 4,
    tests: [
      {
        id: 't1', file: 'a.spec.ts', title: 'should work', project: 'default',
        status: 'passed', duration: 1000, retries: 0, isFlaky: false,
        errors: [], annotations: [], tags: [], attachments: [],
        startedAt: '2025-01-15T10:00:00.000Z', workerId: 0,
      },
      {
        id: 't2', file: 'b.spec.ts', title: 'should fail', project: 'default',
        status: 'failed', duration: 2000, retries: 0, isFlaky: false,
        errors: [{ message: 'assertion failed', stack: 'at line 10' }],
        annotations: [], tags: [], attachments: [],
        startedAt: '2025-01-15T10:00:00.000Z', workerId: 0,
      },
    ],
    environment: { os: 'linux', nodeVersion: 'v20.0.0', playwrightVersion: '1.40.0', ci: 'github-actions' },
    git: { branch: 'main', commit: 'abc123def456', commitMessage: 'test commit', author: 'dev' },
    config: { workers: 4, projects: ['default'], retries: 1, timeout: 30000 },
    ...overrides,
  } as RunResult;
}

describe('buildWebhookPayload', () => {
  it('should build a webhook payload with correct event type', () => {
    const payload = buildWebhookPayload(makeRunResult());

    expect(payload.event).toBe('test-run-completed');
    expect(payload.timestamp).toBe('2025-01-15T10:00:00.000Z');
  });

  it('should include run result summary', () => {
    const payload = buildWebhookPayload(makeRunResult());

    expect(payload.result.id).toBe('run-1');
    expect(payload.result.status).toBe('passed');
    expect(payload.result.duration).toBe(272_000);
    expect(payload.result.totalTests).toBe(487);
    expect(payload.result.passedTests).toBe(479);
    expect(payload.result.failedTests).toBe(3);
    expect(payload.result.flakyTests).toBe(5);
    expect(payload.result.skippedTests).toBe(0);
    expect(payload.result.shardCount).toBe(4);
  });

  it('should include git info', () => {
    const payload = buildWebhookPayload(makeRunResult());

    expect(payload.git.branch).toBe('main');
    expect(payload.git.commit).toBe('abc123def456');
    expect(payload.git.author).toBe('dev');
    expect(payload.git.commitMessage).toBe('test commit');
  });

  it('should include test summaries', () => {
    const payload = buildWebhookPayload(makeRunResult());

    expect(payload.tests).toHaveLength(2);
    expect(payload.tests[0]?.id).toBe('t1');
    expect(payload.tests[0]?.status).toBe('passed');
    expect(payload.tests[0]?.errors).toEqual([]);
  });

  it('should extract error messages from test errors', () => {
    const payload = buildWebhookPayload(makeRunResult());

    expect(payload.tests[1]?.errors).toEqual(['assertion failed']);
  });

  it('should not include stack traces in webhook payload', () => {
    const payload = buildWebhookPayload(makeRunResult());
    const json = JSON.stringify(payload);

    expect(json).not.toContain('at line 10');
  });

  it('should include isFlaky flag for each test', () => {
    const payload = buildWebhookPayload(
      makeRunResult({
        tests: [
          {
            id: 't1', file: 'a.spec.ts', title: 'flaky one', project: 'default',
            status: 'passed', duration: 1000, retries: 2, isFlaky: true,
            errors: [], annotations: [], tags: [], attachments: [],
            startedAt: '2025-01-15T10:00:00.000Z', workerId: 0,
          },
        ],
      }),
    );

    expect(payload.tests[0]?.isFlaky).toBe(true);
  });

  it('should handle empty test array', () => {
    const payload = buildWebhookPayload(makeRunResult({ tests: [] }));

    expect(payload.tests).toEqual([]);
    expect(payload.result.totalTests).toBe(487);
  });

  it('should be JSON-serializable', () => {
    const payload = buildWebhookPayload(makeRunResult());
    const json = JSON.stringify(payload);
    const parsed = JSON.parse(json) as unknown;

    expect(parsed).toEqual(payload);
  });
});
