import { describe, expect, it } from 'vitest';

import { ReportBuilder, generateHtmlReport } from '../index.js';
import type { RunResult } from '@sorry-currents/core';

const now = new Date().toISOString();

function makeRunResult(overrides: Partial<RunResult> = {}): RunResult {
  return {
    id: 'run-1',
    timestamp: now,
    duration: 30_000,
    status: 'passed',
    totalTests: 5,
    passedTests: 3,
    failedTests: 1,
    skippedTests: 0,
    flakyTests: 1,
    shardCount: 2,
    shardIndex: undefined,
    tests: [
      {
        id: 'test1', file: 'a.spec.ts', title: 'should work', project: 'default',
        status: 'passed', duration: 1000, retries: 0, isFlaky: false,
        errors: [], annotations: [], tags: [], attachments: [],
        startedAt: now, workerId: 0,
      },
      {
        id: 'test2', file: 'a.spec.ts', title: 'should fail', project: 'default',
        status: 'failed', duration: 2000, retries: 0, isFlaky: false,
        errors: [{ message: 'Expected true to be false', stack: 'at line 10' }],
        annotations: [], tags: [], attachments: [],
        startedAt: now, workerId: 0,
      },
      {
        id: 'test3', file: 'b.spec.ts', title: 'is flaky', project: 'default',
        status: 'passed', duration: 3000, retries: 2, isFlaky: true,
        errors: [], annotations: [], tags: [], attachments: [],
        startedAt: now, workerId: 1,
      },
      {
        id: 'test4', file: 'b.spec.ts', title: 'should pass', project: 'mobile',
        status: 'passed', duration: 500, retries: 0, isFlaky: false,
        errors: [], annotations: [], tags: [], attachments: [],
        startedAt: now, workerId: 1,
      },
      {
        id: 'test5', file: 'c.spec.ts', title: 'should skip', project: 'default',
        status: 'skipped', duration: 0, retries: 0, isFlaky: false,
        errors: [], annotations: [], tags: [], attachments: [],
        startedAt: now, workerId: 0,
      },
    ],
    environment: { os: 'linux', nodeVersion: 'v20.0.0', playwrightVersion: '1.40.0', ci: 'github-actions' },
    git: { branch: 'main', commit: 'abc123def', author: 'dev', commitMessage: 'test commit', remote: '' },
    config: { workers: 4, projects: ['default', 'mobile'], retries: 1, timeout: 30000 },
    ...overrides,
  };
}

describe('ReportBuilder', () => {
  it('should return error when no RunResult is provided', () => {
    const result = new ReportBuilder().build();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('RunResult');
    }
  });

  it('should build a valid HTML report', () => {
    const result = new ReportBuilder()
      .withRunResult(makeRunResult())
      .build();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain('<!DOCTYPE html>');
      expect(result.value).toContain('sorry-currents');
    }
  });

  it('should include test data in embedded JSON', () => {
    const result = new ReportBuilder()
      .withRunResult(makeRunResult())
      .build();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain('should work');
      expect(result.value).toContain('should fail');
      expect(result.value).toContain('is flaky');
    }
  });

  it('should include error cluster data', () => {
    const result = new ReportBuilder()
      .withRunResult(makeRunResult())
      .build();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain('errorClusters');
    }
  });

  it('should apply custom title', () => {
    const result = new ReportBuilder()
      .withRunResult(makeRunResult())
      .withTitle('My Custom Report')
      .build();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain('My Custom Report');
    }
  });

  it('should apply dark theme', () => {
    const result = new ReportBuilder()
      .withRunResult(makeRunResult())
      .withTheme('dark')
      .build();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain('data-theme="dark"');
    }
  });

  it('should include history data when provided', () => {
    const history = [{
      id: 'test1', title: 'should work', file: 'a.spec.ts', project: 'default',
      totalRuns: 10, passCount: 9, failCount: 1, flakyCount: 0, skipCount: 0,
      avgDuration: 1000, p95Duration: 1200, lastDurations: [900, 1000, 1100],
      flakinessRate: 0, failureRate: 0.1, lastSeen: now, topErrors: [],
    }];

    const result = new ReportBuilder()
      .withRunResult(makeRunResult())
      .withHistory(history)
      .build();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain('"totalRuns":10');
    }
  });

  it('should include artifact base URL when provided', () => {
    const result = new ReportBuilder()
      .withRunResult(makeRunResult())
      .withArtifacts('/artifacts')
      .build();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain('/artifacts');
    }
  });

  it('should produce output under 500KB for typical data', () => {
    const result = new ReportBuilder()
      .withRunResult(makeRunResult())
      .build();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBeLessThan(500 * 1024);
    }
  });

  it('should include all tabs: Tests, Errors, Shards, Flaky, History', () => {
    const result = new ReportBuilder()
      .withRunResult(makeRunResult())
      .build();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain('data-tab="tests"');
      expect(result.value).toContain('data-tab="errors"');
      expect(result.value).toContain('data-tab="shards"');
      expect(result.value).toContain('data-tab="flaky"');
      expect(result.value).toContain('data-tab="history"');
    }
  });

  it('should include search and filter controls', () => {
    const result = new ReportBuilder()
      .withRunResult(makeRunResult())
      .build();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain('id="search"');
      expect(result.value).toContain('id="filter-status"');
    }
  });

  it('should include responsive CSS', () => {
    const result = new ReportBuilder()
      .withRunResult(makeRunResult())
      .build();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain('@media (max-width: 768px)');
    }
  });
});

describe('generateHtmlReport', () => {
  it('should generate HTML using convenience function', () => {
    const html = generateHtmlReport(makeRunResult());
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('sorry-currents');
  });

  it('should apply options', () => {
    const html = generateHtmlReport(makeRunResult(), {
      title: 'Custom Title',
      theme: 'dark',
    });
    expect(html).toContain('Custom Title');
    expect(html).toContain('data-theme="dark"');
  });
});
