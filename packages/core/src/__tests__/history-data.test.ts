import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  readHistory,
  writeHistory,
  updateHistory,
  DEFAULT_HISTORY_PATH,
  type TestHistory,
  type TestResult,
} from '../index.js';

describe('readHistory', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `sorry-currents-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should return empty array when file does not exist', async () => {
    const result = await readHistory(join(tempDir, 'nonexistent.json'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  it('should read valid versioned history data', async () => {
    const data: TestHistory[] = [
      makeHistory({ id: 'test1', title: 'a test', file: 'a.spec.ts' }),
    ];

    const versioned = {
      version: 1,
      generatedBy: 'sorry-currents@0.1.0',
      timestamp: new Date().toISOString(),
      data,
    };

    const filePath = join(tempDir, 'history.json');
    await writeFile(filePath, JSON.stringify(versioned, null, 2), 'utf-8');

    const result = await readHistory(filePath);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]!.id).toBe('test1');
    }
  });

  it('should return error for invalid JSON', async () => {
    const filePath = join(tempDir, 'bad.json');
    await writeFile(filePath, '{{{invalid', 'utf-8');
    const result = await readHistory(filePath);
    expect(result.ok).toBe(false);
  });

  it('should roundtrip through writeHistory', async () => {
    const data: TestHistory[] = [
      makeHistory({ id: 'test1', title: 'a test', file: 'a.spec.ts', totalRuns: 10, passCount: 8, failCount: 1, flakyCount: 1 }),
    ];

    const filePath = join(tempDir, 'rt.json');
    await writeHistory(filePath, data);
    const result = await readHistory(filePath);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(data);
    }
  });
});

describe('writeHistory', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `sorry-currents-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should create parent directories', async () => {
    const filePath = join(tempDir, 'a', 'b', 'history.json');
    const result = await writeHistory(filePath, []);
    expect(result.ok).toBe(true);
  });
});

describe('updateHistory', () => {
  const now = new Date().toISOString();

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
    startedAt: overrides.startedAt ?? now,
    workerId: overrides.workerId ?? 0,
    shardIndex: overrides.shardIndex,
  });

  it('should create new history entries for first-time tests', () => {
    const results = [
      makeTestResult({ id: 'test1', file: 'a.spec.ts', duration: 5000 }),
    ];
    const updated = updateHistory([], results);

    expect(updated).toHaveLength(1);
    expect(updated[0]!.id).toBe('test1');
    expect(updated[0]!.totalRuns).toBe(1);
    expect(updated[0]!.passCount).toBe(1);
    expect(updated[0]!.avgDuration).toBe(5000);
    expect(updated[0]!.lastDurations).toEqual([5000]);
    expect(updated[0]!.flakinessRate).toBe(0);
  });

  it('should merge with existing history data', () => {
    const existing = [
      makeHistory({ id: 'test1', title: 'a test', file: 'a.spec.ts', totalRuns: 10, passCount: 9, failCount: 1, avgDuration: 5000 }),
    ];
    const results = [
      makeTestResult({ id: 'test1', file: 'a.spec.ts', duration: 6000 }),
    ];
    const updated = updateHistory(existing, results);

    expect(updated).toHaveLength(1);
    expect(updated[0]!.totalRuns).toBe(11);
    expect(updated[0]!.passCount).toBe(10);
  });

  it('should track flaky tests', () => {
    const results = [
      makeTestResult({ id: 'test1', file: 'a.spec.ts', status: 'passed', isFlaky: true, retries: 1 }),
    ];
    const updated = updateHistory([], results);

    expect(updated[0]!.flakyCount).toBe(1);
    expect(updated[0]!.flakinessRate).toBe(1);
    expect(updated[0]!.passCount).toBe(0); // flaky doesn't count as clean pass
  });

  it('should track failed tests and errors', () => {
    const results = [
      makeTestResult({
        id: 'test1',
        file: 'a.spec.ts',
        status: 'failed',
        errors: [{ message: 'Expected true to be false', stack: 'at test.ts:10' }],
      }),
    ];
    const updated = updateHistory([], results);

    expect(updated[0]!.failCount).toBe(1);
    expect(updated[0]!.failureRate).toBe(1);
    expect(updated[0]!.topErrors).toHaveLength(1);
    expect(updated[0]!.topErrors[0]!.count).toBe(1);
  });

  it('should accumulate error counts across updates', () => {
    const existing = [
      makeHistory({
        id: 'test1', title: 'a test', file: 'a.spec.ts',
        totalRuns: 5, failCount: 2,
        topErrors: [{ message: 'Expected true to be false', count: 2, lastSeen: now }],
      }),
    ];
    const results = [
      makeTestResult({
        id: 'test1', file: 'a.spec.ts', status: 'failed',
        errors: [{ message: 'Expected true to be false' }],
      }),
    ];
    const updated = updateHistory(existing, results);

    expect(updated[0]!.topErrors[0]!.count).toBe(3);
  });

  it('should preserve existing entries not in new results', () => {
    const existing = [
      makeHistory({ id: 'test1', title: 'a test', file: 'a.spec.ts' }),
      makeHistory({ id: 'test2', title: 'b test', file: 'b.spec.ts' }),
    ];
    const results = [
      makeTestResult({ id: 'test1', file: 'a.spec.ts' }),
    ];
    const updated = updateHistory(existing, results);

    expect(updated).toHaveLength(2);
  });

  it('should cap lastDurations at 30', () => {
    const existing = [
      makeHistory({
        id: 'test1', title: 'a test', file: 'a.spec.ts',
        lastDurations: Array.from({ length: 30 }, () => 1000),
      }),
    ];
    const results = [
      makeTestResult({ id: 'test1', file: 'a.spec.ts', duration: 2000 }),
    ];
    const updated = updateHistory(existing, results);

    expect(updated[0]!.lastDurations).toHaveLength(30);
    expect(updated[0]!.lastDurations.at(-1)).toBe(2000);
  });

  it('should handle skipped tests in duration tracking', () => {
    const results = [
      makeTestResult({ id: 'test1', file: 'a.spec.ts', status: 'skipped', duration: 0 }),
    ];
    const updated = updateHistory([], results);

    expect(updated[0]!.skipCount).toBe(1);
    expect(updated[0]!.lastDurations).toEqual([]);
  });
});

describe('DEFAULT_HISTORY_PATH', () => {
  it('should be in .sorry-currents directory', () => {
    expect(DEFAULT_HISTORY_PATH).toBe('.sorry-currents/history.json');
  });
});

// --- Helpers ---

function makeHistory(overrides: Partial<TestHistory> & { id: string; title: string; file: string }): TestHistory {
  return {
    id: overrides.id,
    title: overrides.title,
    file: overrides.file,
    project: overrides.project ?? 'default',
    totalRuns: overrides.totalRuns ?? 1,
    passCount: overrides.passCount ?? 1,
    failCount: overrides.failCount ?? 0,
    flakyCount: overrides.flakyCount ?? 0,
    skipCount: overrides.skipCount ?? 0,
    avgDuration: overrides.avgDuration ?? 1000,
    p95Duration: overrides.p95Duration ?? 1200,
    lastDurations: overrides.lastDurations ?? [1000],
    flakinessRate: overrides.flakinessRate ?? 0,
    failureRate: overrides.failureRate ?? 0,
    lastSeen: overrides.lastSeen ?? new Date().toISOString(),
    topErrors: overrides.topErrors ?? [],
  };
}
