import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  readTimingData,
  writeTimingData,
  updateTimingData,
  DEFAULT_TIMING_DATA_PATH,
  type ShardTimingData,
  type TestResult,
} from '../index.js';

describe('readTimingData', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `sorry-currents-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should return empty array when file does not exist (cold start)', async () => {
    const result = await readTimingData(join(tempDir, 'nonexistent.json'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  it('should read valid versioned timing data', async () => {
    const data: ShardTimingData[] = [
      { testId: 'test1', file: 'a.spec.ts', project: 'default', avgDuration: 5000, p95Duration: 7000, samples: 10 },
      { testId: 'test2', file: 'b.spec.ts', project: 'mobile', avgDuration: 3000, p95Duration: 4500, samples: 5 },
    ];

    const versioned = {
      version: 1,
      generatedBy: 'sorry-currents@0.1.0',
      timestamp: new Date().toISOString(),
      data,
    };

    const filePath = join(tempDir, 'timing-data.json');
    await writeFile(filePath, JSON.stringify(versioned, null, 2), 'utf-8');

    const result = await readTimingData(filePath);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0]!.testId).toBe('test1');
      expect(result.value[1]!.avgDuration).toBe(3000);
    }
  });

  it('should read plain array format (backwards compat)', async () => {
    const data: ShardTimingData[] = [
      { testId: 'test1', file: 'a.spec.ts', project: '', avgDuration: 1000, p95Duration: 1200, samples: 1 },
    ];

    const filePath = join(tempDir, 'timing-data.json');
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');

    const result = await readTimingData(filePath);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]!.testId).toBe('test1');
    }
  });

  it('should return error for invalid JSON', async () => {
    const filePath = join(tempDir, 'bad.json');
    await writeFile(filePath, 'not valid json {{{', 'utf-8');

    const result = await readTimingData(filePath);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBeDefined();
    }
  });

  it('should return error for wrong schema', async () => {
    const filePath = join(tempDir, 'wrong-schema.json');
    await writeFile(filePath, JSON.stringify([{ wrong: 'shape' }]), 'utf-8');

    const result = await readTimingData(filePath);
    expect(result.ok).toBe(false);
  });
});

describe('writeTimingData', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `sorry-currents-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should write versioned JSON with trailing newline', async () => {
    const data: ShardTimingData[] = [
      { testId: 'test1', file: 'a.spec.ts', project: 'default', avgDuration: 5000, p95Duration: 7000, samples: 10 },
    ];

    const filePath = join(tempDir, 'output', 'timing.json');
    const result = await writeTimingData(filePath, data);

    expect(result.ok).toBe(true);
    expect(existsSync(filePath)).toBe(true);

    const raw = await readFile(filePath, 'utf-8');
    expect(raw.endsWith('\n')).toBe(true);

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed['version']).toBe(1);
    expect(parsed['generatedBy']).toContain('sorry-currents');
    expect(parsed['timestamp']).toBeDefined();
    expect(Array.isArray(parsed['data'])).toBe(true);
  });

  it('should create parent directories', async () => {
    const deepPath = join(tempDir, 'a', 'b', 'c', 'timing.json');
    const result = await writeTimingData(deepPath, []);

    expect(result.ok).toBe(true);
    expect(existsSync(deepPath)).toBe(true);
  });

  it('should roundtrip through readTimingData', async () => {
    const data: ShardTimingData[] = [
      { testId: 'test1', file: 'a.spec.ts', project: 'default', avgDuration: 5000, p95Duration: 7000, samples: 10 },
      { testId: 'test2', file: 'b.spec.ts', project: '', avgDuration: 3000, p95Duration: 4500, samples: 5 },
    ];

    const filePath = join(tempDir, 'roundtrip.json');
    await writeTimingData(filePath, data);
    const result = await readTimingData(filePath);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(data);
    }
  });
});

describe('updateTimingData', () => {
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

  it('should create new entries for first-time tests', () => {
    const results: TestResult[] = [
      makeTestResult({ id: 'test1', file: 'a.spec.ts', duration: 5000 }),
      makeTestResult({ id: 'test2', file: 'b.spec.ts', duration: 3000 }),
    ];

    const updated = updateTimingData([], results);

    expect(updated).toHaveLength(2);
    expect(updated.find((t) => t.testId === 'test1')?.avgDuration).toBe(5000);
    expect(updated.find((t) => t.testId === 'test1')?.samples).toBe(1);
    expect(updated.find((t) => t.testId === 'test2')?.avgDuration).toBe(3000);
  });

  it('should merge with existing timing data', () => {
    const existing: ShardTimingData[] = [
      { testId: 'test1', file: 'a.spec.ts', project: 'default', avgDuration: 5000, p95Duration: 7000, samples: 10 },
    ];

    const results: TestResult[] = [
      makeTestResult({ id: 'test1', file: 'a.spec.ts', duration: 6000 }),
    ];

    const updated = updateTimingData(existing, results);

    expect(updated).toHaveLength(1);
    const entry = updated[0]!;
    expect(entry.samples).toBe(11);
    // New avg: (5000 * 10 + 6000) / 11 = 5090.9... ≈ 5091
    expect(entry.avgDuration).toBeCloseTo(5091, 0);
  });

  it('should skip skipped tests', () => {
    const results: TestResult[] = [
      makeTestResult({ id: 'test1', file: 'a.spec.ts', status: 'skipped', duration: 0 }),
    ];

    const updated = updateTimingData([], results);
    expect(updated).toHaveLength(0);
  });

  it('should skip interrupted tests', () => {
    const results: TestResult[] = [
      makeTestResult({ id: 'test1', file: 'a.spec.ts', status: 'interrupted', duration: 500 }),
    ];

    const updated = updateTimingData([], results);
    expect(updated).toHaveLength(0);
  });

  it('should cap samples at MAX_SAMPLES (50)', () => {
    const existing: ShardTimingData[] = [
      { testId: 'test1', file: 'a.spec.ts', project: 'default', avgDuration: 1000, p95Duration: 1200, samples: 50 },
    ];

    const results: TestResult[] = [
      makeTestResult({ id: 'test1', file: 'a.spec.ts', duration: 1100 }),
    ];

    const updated = updateTimingData(existing, results);
    expect(updated[0]!.samples).toBe(50);
  });

  it('should preserve existing entries not in new results', () => {
    const existing: ShardTimingData[] = [
      { testId: 'test1', file: 'a.spec.ts', project: 'default', avgDuration: 1000, p95Duration: 1200, samples: 5 },
      { testId: 'test2', file: 'b.spec.ts', project: 'default', avgDuration: 2000, p95Duration: 2500, samples: 3 },
    ];

    const results: TestResult[] = [
      makeTestResult({ id: 'test1', file: 'a.spec.ts', duration: 1100 }),
    ];

    const updated = updateTimingData(existing, results);
    expect(updated).toHaveLength(2);
    expect(updated.find((t) => t.testId === 'test2')?.avgDuration).toBe(2000);
  });

  it('should update p95 upward when new duration exceeds it', () => {
    const existing: ShardTimingData[] = [
      { testId: 'test1', file: 'a.spec.ts', project: 'default', avgDuration: 1000, p95Duration: 1200, samples: 5 },
    ];

    const results: TestResult[] = [
      makeTestResult({ id: 'test1', file: 'a.spec.ts', duration: 2000 }),
    ];

    const updated = updateTimingData(existing, results);
    // p95 should go up since 2000 > 1200
    expect(updated[0]!.p95Duration).toBe(2000);
  });

  it('should slowly decay p95 when new duration is below it', () => {
    const existing: ShardTimingData[] = [
      { testId: 'test1', file: 'a.spec.ts', project: 'default', avgDuration: 1000, p95Duration: 1200, samples: 5 },
    ];

    const results: TestResult[] = [
      makeTestResult({ id: 'test1', file: 'a.spec.ts', duration: 800 }),
    ];

    const updated = updateTimingData(existing, results);
    // p95 should stay at max(1200, 1200*0.95 + 800*0.05) = max(1200, 1180) = 1200
    expect(updated[0]!.p95Duration).toBe(1200);
  });

  it('should handle failed tests (still valid timing data)', () => {
    const results: TestResult[] = [
      makeTestResult({ id: 'test1', file: 'a.spec.ts', status: 'failed', duration: 15000 }),
    ];

    const updated = updateTimingData([], results);
    expect(updated).toHaveLength(1);
    expect(updated[0]!.avgDuration).toBe(15000);
  });

  it('should handle timedOut tests', () => {
    const results: TestResult[] = [
      makeTestResult({ id: 'test1', file: 'a.spec.ts', status: 'timedOut', duration: 30000 }),
    ];

    const updated = updateTimingData([], results);
    expect(updated).toHaveLength(1);
    expect(updated[0]!.avgDuration).toBe(30000);
  });
});

describe('DEFAULT_TIMING_DATA_PATH', () => {
  it('should be a relative path in .sorry-currents directory', () => {
    expect(DEFAULT_TIMING_DATA_PATH).toBe('.sorry-currents/timing-data.json');
  });
});
