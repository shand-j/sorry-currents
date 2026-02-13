import { describe, expect, it } from 'vitest';

import { buildSlackPayload } from '../notifications/slack.js';
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

describe('buildSlackPayload', () => {
  it('should build a valid Slack Block Kit payload', () => {
    const payload = buildSlackPayload({ runResult: makeRunResult() });

    expect(payload.text).toBeDefined();
    expect(payload.blocks).toBeDefined();
    expect(payload.blocks.length).toBeGreaterThan(0);
  });

  it('should include fallback text with summary', () => {
    const payload = buildSlackPayload({ runResult: makeRunResult() });

    expect(payload.text).toContain('Passed');
    expect(payload.text).toContain('479');
    expect(payload.text).toContain('487');
  });

  it('should include header block with status', () => {
    const payload = buildSlackPayload({
      runResult: makeRunResult({ status: 'passed' }),
    });

    const header = payload.blocks.find((b) => b.type === 'header');
    expect(header).toBeDefined();
    expect(header?.text?.text).toContain('Passed');
  });

  it('should show failed status when run failed', () => {
    const payload = buildSlackPayload({
      runResult: makeRunResult({ status: 'failed' }),
    });

    const header = payload.blocks.find((b) => b.type === 'header');
    expect(header?.text?.text).toContain('Failed');
  });

  it('should include branch and commit in section fields', () => {
    const payload = buildSlackPayload({ runResult: makeRunResult() });

    const section = payload.blocks.find(
      (b) => b.type === 'section' && b.fields && b.fields.length > 0,
    );
    expect(section).toBeDefined();
    const fieldTexts = section?.fields?.map((f) => f.text).join(' ') ?? '';
    expect(fieldTexts).toContain('main');
    expect(fieldTexts).toContain('abc123d');
  });

  it('should include flaky warning block when flaky tests exist', () => {
    const payload = buildSlackPayload({
      runResult: makeRunResult({ flakyTests: 3 }),
    });

    const flakyBlock = payload.blocks.find(
      (b) => b.type === 'section' && b.text?.text?.includes('flaky'),
    );
    expect(flakyBlock).toBeDefined();
    expect(flakyBlock?.text?.text).toContain('3 flaky tests');
  });

  it('should not include flaky block when no flaky tests', () => {
    const payload = buildSlackPayload({
      runResult: makeRunResult({ flakyTests: 0 }),
    });

    const flakyBlock = payload.blocks.find(
      (b) => b.type === 'section' && b.text?.text?.includes('flaky'),
    );
    expect(flakyBlock).toBeUndefined();
  });

  it('should include failed test details', () => {
    const runResult = makeRunResult({
      tests: [
        {
          id: 't1', file: 'checkout.spec.ts', title: 'should work', project: 'default',
          status: 'failed', duration: 5000, retries: 0, isFlaky: false,
          errors: [{ message: 'Expected true to be false' }],
          annotations: [], tags: [], attachments: [],
          startedAt: '2025-01-15T10:00:00.000Z', workerId: 0,
        },
      ],
    });

    const payload = buildSlackPayload({ runResult });

    const failedBlock = payload.blocks.find(
      (b) => b.type === 'section' && b.text?.text?.includes('Failed Tests'),
    );
    expect(failedBlock).toBeDefined();
    expect(failedBlock?.text?.text).toContain('checkout.spec.ts');
  });

  it('should limit failed test list to 5 entries', () => {
    const tests = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i}`, file: `test${i}.spec.ts`, title: `test ${i}`, project: 'default',
      status: 'failed' as const, duration: 1000, retries: 0, isFlaky: false,
      errors: [{ message: `Error ${i}` }],
      annotations: [], tags: [], attachments: [],
      startedAt: '2025-01-15T10:00:00.000Z', workerId: 0,
    }));

    const payload = buildSlackPayload({ runResult: makeRunResult({ tests }) });

    const failedBlock = payload.blocks.find(
      (b) => b.type === 'section' && b.text?.text?.includes('Failed Tests'),
    );
    expect(failedBlock?.text?.text).toContain('and 5 more');
  });

  it('should include report URL when provided', () => {
    const payload = buildSlackPayload({
      runResult: makeRunResult(),
      reportUrl: 'https://reports.example.com/run-1',
    });

    const contextBlock = payload.blocks.find(
      (b) => b.type === 'context' && b.elements?.some((e) => e.text.includes('Report')),
    );
    expect(contextBlock).toBeDefined();
  });

  it('should not include report link when no URL provided', () => {
    const payload = buildSlackPayload({ runResult: makeRunResult() });

    const reportBlock = payload.blocks.find(
      (b) => b.type === 'context' && b.elements?.some((e) => e.text.includes('Report')),
    );
    expect(reportBlock).toBeUndefined();
  });

  it('should include footer with author and commit message', () => {
    const payload = buildSlackPayload({ runResult: makeRunResult() });

    const footer = payload.blocks.find(
      (b) => b.type === 'context' && b.elements?.some((e) => e.text.includes('sorry-currents')),
    );
    expect(footer).toBeDefined();
    const footerText = footer?.elements?.map((e) => e.text).join('') ?? '';
    expect(footerText).toContain('dev');
    expect(footerText).toContain('test commit');
  });

  it('should use singular form for 1 flaky test', () => {
    const payload = buildSlackPayload({
      runResult: makeRunResult({ flakyTests: 1 }),
    });

    const flakyBlock = payload.blocks.find(
      (b) => b.type === 'section' && b.text?.text?.includes('flaky'),
    );
    expect(flakyBlock?.text?.text).toContain('1 flaky test');
    expect(flakyBlock?.text?.text).not.toContain('tests');
  });
});
