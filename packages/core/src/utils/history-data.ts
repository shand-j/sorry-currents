import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';

import { z } from 'zod';

import { type Result, ok, err } from '../result.js';
import { AppError } from '../errors/app-error.js';
import { ErrorCode } from '../errors/error-codes.js';
import { TestHistorySchema, type TestHistory, type ErrorSummary } from '../schemas/test-history.js';
import { type TestResult } from '../schemas/test-result.js';
import { type VersionedData } from '../schemas/versioned-data.js';
import { normalizeError } from './normalize-error.js';

/** Current schema version for history data files */
const HISTORY_DATA_VERSION = 1 as const;

/** Maximum number of recent durations to track per test */
const MAX_LAST_DURATIONS = 30 as const;

/** Maximum number of top errors to track per test */
const MAX_TOP_ERRORS = 5 as const;

/** Default path for history data file */
export const DEFAULT_HISTORY_PATH = '.sorry-currents/history.json';

/**
 * Read and validate test history from a JSON file.
 * Returns an empty array when the file doesn't exist (first run).
 */
export async function readHistory(
  path: string,
): Promise<Result<TestHistory[]>> {
  if (!existsSync(path)) {
    return ok([]);
  }

  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (cause) {
    return err(
      new AppError(
        ErrorCode.FILE_NOT_FOUND,
        `Failed to read history data: ${path}`,
        { path },
        cause as Error,
      ),
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    return err(AppError.fileParseError(path, cause as Error));
  }

  // Support both versioned and plain array formats
  const data = isVersionedData(parsed) ? parsed.data : parsed;

  const validated = z.array(TestHistorySchema).safeParse(data);
  if (!validated.success) {
    return err(AppError.validation(validated.error, path));
  }

  return ok(validated.data);
}

/**
 * Write test history to a versioned JSON file.
 */
export async function writeHistory(
  path: string,
  data: readonly TestHistory[],
): Promise<Result<void>> {
  try {
    await mkdir(dirname(path), { recursive: true });

    const versioned: VersionedData<readonly TestHistory[]> = {
      version: HISTORY_DATA_VERSION,
      generatedBy: 'sorry-currents@0.1.0',
      timestamp: new Date().toISOString(),
      data,
    };

    const json = JSON.stringify(versioned, null, 2) + '\n';
    await writeFile(path, json, 'utf-8');
    return ok(undefined);
  } catch (cause) {
    return err(AppError.fileWriteError(path, cause as Error));
  }
}

/**
 * Update test history with results from a completed run.
 * Pure computation — merges new test results into existing history entries.
 */
export function updateHistory(
  existing: readonly TestHistory[],
  testResults: readonly TestResult[],
): TestHistory[] {
  const historyMap = new Map<string, TestHistory>();

  // Index existing history by test ID
  for (const entry of existing) {
    historyMap.set(entry.id, { ...entry, topErrors: [...entry.topErrors] });
  }

  const now = new Date().toISOString();

  for (const result of testResults) {
    const existingEntry = historyMap.get(result.id);

    if (existingEntry) {
      const totalRuns = existingEntry.totalRuns + 1;
      const passCount = existingEntry.passCount + (result.status === 'passed' && !result.isFlaky ? 1 : 0);
      const failCount = existingEntry.failCount + (result.status === 'failed' || result.status === 'timedOut' ? 1 : 0);
      const flakyCount = existingEntry.flakyCount + (result.isFlaky ? 1 : 0);
      const skipCount = existingEntry.skipCount + (result.status === 'skipped' ? 1 : 0);

      // Update running average duration (exclude skipped)
      const avgDuration =
        result.status === 'skipped'
          ? existingEntry.avgDuration
          : Math.round(
              (existingEntry.avgDuration * existingEntry.totalRuns + result.duration) / totalRuns,
            );

      // Approximate p95 update
      const p95Duration =
        result.status === 'skipped'
          ? existingEntry.p95Duration
          : Math.round(
              Math.max(
                existingEntry.p95Duration,
                result.duration > existingEntry.p95Duration
                  ? result.duration
                  : existingEntry.p95Duration * 0.95 + result.duration * 0.05,
              ),
            );

      // Rolling window of last durations
      const lastDurations =
        result.status === 'skipped'
          ? existingEntry.lastDurations
          : [...existingEntry.lastDurations, result.duration].slice(-MAX_LAST_DURATIONS);

      // Compute rates
      const flakinessRate = totalRuns > 0 ? flakyCount / totalRuns : 0;
      const failureRate = totalRuns > 0 ? failCount / totalRuns : 0;

      // Update error tracking
      const topErrors = mergeErrors(existingEntry.topErrors, result, now);

      historyMap.set(result.id, {
        id: result.id,
        title: result.title,
        file: result.file,
        project: result.project,
        totalRuns,
        passCount,
        failCount,
        flakyCount,
        skipCount,
        avgDuration,
        p95Duration,
        lastDurations,
        flakinessRate: round4(flakinessRate),
        failureRate: round4(failureRate),
        lastSeen: now,
        topErrors,
      });
    } else {
      // New test — initialize from first result
      const isPassed = result.status === 'passed' && !result.isFlaky;
      const isFailed = result.status === 'failed' || result.status === 'timedOut';
      const lastDurations = result.status === 'skipped' ? [] : [result.duration];

      const topErrors: ErrorSummary[] = [];
      if (isFailed && result.errors.length > 0) {
        const msg = normalizeError(result.errors[0]!.message);
        topErrors.push({
          message: msg,
          count: 1,
          lastSeen: now,
          exampleStack: result.errors[0]!.stack,
        });
      }

      historyMap.set(result.id, {
        id: result.id,
        title: result.title,
        file: result.file,
        project: result.project,
        totalRuns: 1,
        passCount: isPassed ? 1 : 0,
        failCount: isFailed ? 1 : 0,
        flakyCount: result.isFlaky ? 1 : 0,
        skipCount: result.status === 'skipped' ? 1 : 0,
        avgDuration: result.duration,
        p95Duration: result.duration,
        lastDurations,
        flakinessRate: result.isFlaky ? 1 : 0,
        failureRate: isFailed ? 1 : 0,
        lastSeen: now,
        topErrors,
      });
    }
  }

  return [...historyMap.values()];
}

/**
 * Merge new errors from a test result into the existing top errors list.
 * Groups by normalized message, keeps top N by count.
 */
function mergeErrors(
  existing: readonly ErrorSummary[],
  result: TestResult,
  now: string,
): ErrorSummary[] {
  if (result.status !== 'failed' && result.status !== 'timedOut') {
    return [...existing];
  }
  if (result.errors.length === 0) {
    return [...existing];
  }

  const errorMap = new Map<string, ErrorSummary>();
  for (const e of existing) {
    errorMap.set(e.message, { ...e });
  }

  for (const error of result.errors) {
    const normalized = normalizeError(error.message);
    const entry = errorMap.get(normalized);
    if (entry) {
      entry.count += 1;
      entry.lastSeen = now;
      if (error.stack) {
        entry.exampleStack = error.stack;
      }
    } else {
      errorMap.set(normalized, {
        message: normalized,
        count: 1,
        lastSeen: now,
        exampleStack: error.stack,
      });
    }
  }

  // Keep top N by count
  return [...errorMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_TOP_ERRORS);
}

/** Round to 4 decimal places for rates */
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function isVersionedData(data: unknown): data is VersionedData<unknown> {
  return (
    typeof data === 'object' &&
    data !== null &&
    'version' in data &&
    'data' in data
  );
}
