import { describe, expect, it } from 'vitest';

import {
  buildGitHubCommentBody,
  getCommentMarker,
} from '../notifications/github-comment.js';
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
    tests: [],
    environment: { os: 'linux', nodeVersion: 'v20.0.0', playwrightVersion: '1.40.0', ci: 'github-actions' },
    git: { branch: 'main', commit: 'abc123def456', commitMessage: 'test commit', author: 'dev' },
    config: { workers: 4, projects: ['default'], retries: 1, timeout: 30000 },
    ...overrides,
  } as RunResult;
}

describe('buildGitHubCommentBody', () => {
  it('should build a PR comment with summary table', () => {
    const payload = buildGitHubCommentBody({
      runResult: makeRunResult(),
      owner: 'my-org',
      repo: 'my-repo',
      prNumber: 42,
    });

    expect(payload.owner).toBe('my-org');
    expect(payload.repo).toBe('my-repo');
    expect(payload.issueNumber).toBe(42);
    expect(payload.commitSha).toBe('abc123def456');
    expect(payload.body).toContain(getCommentMarker());
    expect(payload.body).toContain('sorry-currents Test Results');
    expect(payload.body).toContain('487');
    expect(payload.body).toContain('479');
    expect(payload.body).toContain('3');
    expect(payload.body).toContain('5');
  });

  it('should include failed tests section when there are failures', () => {
    const runResult = makeRunResult({
      failedTests: 1,
      tests: [
        {
          id: 't1', file: 'checkout.spec.ts', title: 'should apply discount', project: 'default',
          status: 'failed', duration: 12300, retries: 0, isFlaky: false,
          errors: [{ message: 'Expected 19.99, got 20.00' }],
          annotations: [], tags: [], attachments: [], startedAt: '2025-01-15T10:00:00.000Z', workerId: 0,
        },
      ],
    });

    const payload = buildGitHubCommentBody({
      runResult,
      owner: 'o',
      repo: 'r',
      prNumber: 1,
    });

    expect(payload.body).toContain('Failed Tests');
    expect(payload.body).toContain('checkout.spec.ts > should apply discount');
    expect(payload.body).toContain('Expected 19.99, got 20.00');
  });

  it('should include flaky tests section', () => {
    const runResult = makeRunResult({
      flakyTests: 1,
      tests: [
        {
          id: 't1', file: 'search.spec.ts', title: 'should autocomplete', project: 'default',
          status: 'passed', duration: 3000, retries: 2, isFlaky: true,
          errors: [], annotations: [], tags: [], attachments: [],
          startedAt: '2025-01-15T10:00:00.000Z', workerId: 0,
        },
      ],
    });

    const payload = buildGitHubCommentBody({
      runResult,
      owner: 'o',
      repo: 'r',
      prNumber: 1,
    });

    expect(payload.body).toContain('Flaky Tests');
    expect(payload.body).toContain('search.spec.ts > should autocomplete');
    expect(payload.body).toContain('2');
  });

  it('should include report URL when provided', () => {
    const payload = buildGitHubCommentBody({
      runResult: makeRunResult(),
      owner: 'o',
      repo: 'r',
      prNumber: 1,
      reportUrl: 'https://reports.example.com/run-1',
    });

    expect(payload.body).toContain('[Full Report](https://reports.example.com/run-1)');
  });

  it('should not include report link when no URL provided', () => {
    const payload = buildGitHubCommentBody({
      runResult: makeRunResult(),
      owner: 'o',
      repo: 'r',
      prNumber: 1,
    });

    expect(payload.body).not.toContain('Full Report');
  });

  it('should truncate long error messages', () => {
    const longError = 'A'.repeat(200);
    const runResult = makeRunResult({
      tests: [
        {
          id: 't1', file: 'a.spec.ts', title: 'long error', project: 'default',
          status: 'failed', duration: 1000, retries: 0, isFlaky: false,
          errors: [{ message: longError }],
          annotations: [], tags: [], attachments: [],
          startedAt: '2025-01-15T10:00:00.000Z', workerId: 0,
        },
      ],
    });

    const payload = buildGitHubCommentBody({
      runResult,
      owner: 'o',
      repo: 'r',
      prNumber: 1,
    });

    // Error should be truncated with ...
    expect(payload.body).toContain('...');
    expect(payload.body).not.toContain(longError);
  });

  it('should show failed status icon when run failed', () => {
    const payload = buildGitHubCommentBody({
      runResult: makeRunResult({ status: 'failed' }),
      owner: 'o',
      repo: 'r',
      prNumber: 1,
    });

    expect(payload.body).toContain('❌ sorry-currents Test Results');
  });

  it('should show passed status icon when run passed', () => {
    const payload = buildGitHubCommentBody({
      runResult: makeRunResult({ status: 'passed' }),
      owner: 'o',
      repo: 'r',
      prNumber: 1,
    });

    expect(payload.body).toContain('✅ sorry-currents Test Results');
  });
});

describe('getCommentMarker', () => {
  it('should return a consistent HTML comment marker', () => {
    const marker = getCommentMarker();
    expect(marker).toContain('<!--');
    expect(marker).toContain('sorry-currents');
  });
});
