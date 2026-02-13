import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';

import { type Result, ok, err } from '../result.js';
import { AppError } from '../errors/app-error.js';
import { ErrorCode } from '../errors/error-codes.js';
import { ShardTimingDataSchema, type ShardTimingData } from '../schemas/shard-timing-data.js';
import { type VersionedData } from '../schemas/versioned-data.js';
import { type TestResult } from '../schemas/test-result.js';

import { z } from 'zod';

/** Current schema version for timing data files */
const TIMING_DATA_VERSION = 1 as const;

/** Maximum number of duration samples to keep per test */
const MAX_SAMPLES = 50 as const;

/** Default path for timing data file */
export const DEFAULT_TIMING_DATA_PATH = '.sorry-currents/timing-data.json';

/**
 * Read and validate timing data from a JSON file.
 * Returns an empty array (not an error) when the file doesn't exist — this is
 * the cold start case and is expected.
 */
export async function readTimingData(
  path: string,
): Promise<Result<ShardTimingData[]>> {
  if (!existsSync(path)) {
    return ok([]);
  }

  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (cause) {
    return err(
      new AppError(ErrorCode.FILE_NOT_FOUND, `Failed to read timing data: ${path}`, { path }, cause as Error),
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

  const validated = z.array(ShardTimingDataSchema).safeParse(data);
  if (!validated.success) {
    return err(AppError.validation(validated.error, path));
  }

  return ok(validated.data);
}

/**
 * Write timing data to a JSON file with versioning metadata.
 */
export async function writeTimingData(
  path: string,
  data: readonly ShardTimingData[],
): Promise<Result<void>> {
  try {
    await mkdir(dirname(path), { recursive: true });

    const versioned: VersionedData<readonly ShardTimingData[]> = {
      version: TIMING_DATA_VERSION,
      generatedBy: `sorry-currents@0.1.0`,
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
 * Update timing data with results from a completed test run.
 * Merges new durations into existing data, keeping a rolling window of samples.
 * Pure computation — given old data + new results, produces updated data.
 */
export function updateTimingData(
  existing: readonly ShardTimingData[],
  testResults: readonly TestResult[],
): ShardTimingData[] {
  const dataMap = new Map<string, ShardTimingData>();

  // Index existing data by testId
  for (const entry of existing) {
    dataMap.set(entry.testId, { ...entry });
  }

  // Merge in new results
  for (const result of testResults) {
    // Skip skipped/interrupted tests — no useful timing data
    if (result.status === 'skipped' || result.status === 'interrupted') {
      continue;
    }

    const existingEntry = dataMap.get(result.id);

    if (existingEntry) {
      // Update running average and p95
      const newSamples = existingEntry.samples + 1;
      const newAvg =
        (existingEntry.avgDuration * existingEntry.samples + result.duration) / newSamples;

      // Approximate p95 update — weighted towards higher values
      const newP95 = Math.max(
        existingEntry.p95Duration,
        result.duration > existingEntry.p95Duration
          ? result.duration
          : existingEntry.p95Duration * 0.95 + result.duration * 0.05,
      );

      dataMap.set(result.id, {
        testId: result.id,
        file: result.file,
        project: result.project,
        avgDuration: Math.round(newAvg),
        p95Duration: Math.round(newP95),
        samples: Math.min(newSamples, MAX_SAMPLES),
      });
    } else {
      // New test — initialize with first sample
      dataMap.set(result.id, {
        testId: result.id,
        file: result.file,
        project: result.project,
        avgDuration: result.duration,
        p95Duration: result.duration,
        samples: 1,
      });
    }
  }

  return [...dataMap.values()];
}

function isVersionedData(data: unknown): data is VersionedData<unknown> {
  return (
    typeof data === 'object' &&
    data !== null &&
    'version' in data &&
    'data' in data
  );
}
