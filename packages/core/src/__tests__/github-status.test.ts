import { describe, expect, it } from 'vitest';

import { buildGitHubStatusPayload } from '../notifications/github-status.js';
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

describe('buildGitHubStatusPayload', () => {
  it('should set success state when run passed', () => {
    const payload = buildGitHubStatusPayload({
      runResult: makeRunResult({ status: 'passed' }),
      owner: 'my-org',
      repo: 'my-repo',
    });

    expect(payload.state).toBe('success');
    expect(payload.owner).toBe('my-org');
    expect(payload.repo).toBe('my-repo');
    expect(payload.sha).toBe('abc123def456');
    expect(payload.context).toBe('sorry-currents');
  });

  it('should set failure state when run failed', () => {
    const payload = buildGitHubStatusPayload({
      runResult: makeRunResult({ status: 'failed' }),
      owner: 'o',
      repo: 'r',
    });

    expect(payload.state).toBe('failure');
  });

  it('should include pass/fail counts in description', () => {
    const payload = buildGitHubStatusPayload({
      runResult: makeRunResult({ passedTests: 100, failedTests: 5 }),
      owner: 'o',
      repo: 'r',
    });

    expect(payload.description).toContain('100 passed');
    expect(payload.description).toContain('5 failed');
  });

  it('should include flaky count when present', () => {
    const payload = buildGitHubStatusPayload({
      runResult: makeRunResult({ flakyTests: 3 }),
      owner: 'o',
      repo: 'r',
    });

    expect(payload.description).toContain('3 flaky');
  });

  it('should not include flaky count when zero', () => {
    const payload = buildGitHubStatusPayload({
      runResult: makeRunResult({ flakyTests: 0 }),
      owner: 'o',
      repo: 'r',
    });

    expect(payload.description).not.toContain('flaky');
  });

  it('should include duration in description', () => {
    const payload = buildGitHubStatusPayload({
      runResult: makeRunResult({ duration: 272_000 }),
      owner: 'o',
      repo: 'r',
    });

    expect(payload.description).toContain('4m 32s');
  });

  it('should include target URL when report URL provided', () => {
    const payload = buildGitHubStatusPayload({
      runResult: makeRunResult(),
      owner: 'o',
      repo: 'r',
      reportUrl: 'https://reports.example.com/run-1',
    });

    expect(payload.targetUrl).toBe('https://reports.example.com/run-1');
  });

  it('should not include target URL when no report URL', () => {
    const payload = buildGitHubStatusPayload({
      runResult: makeRunResult(),
      owner: 'o',
      repo: 'r',
    });

    expect(payload.targetUrl).toBeUndefined();
  });

  it('should truncate description to 140 characters', () => {
    // Create a run with enough data to make a long description
    const payload = buildGitHubStatusPayload({
      runResult: makeRunResult({
        passedTests: 1_000_000,
        failedTests: 999_999,
        flakyTests: 888_888,
        duration: 999_999_999,
      }),
      owner: 'o',
      repo: 'r',
    });

    expect(payload.description.length).toBeLessThanOrEqual(140);
  });
});
