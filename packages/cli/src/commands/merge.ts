import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Command } from 'commander';

import {
  type RunResult,
  RunResultSchema,
  AppError,
  ConsoleLogger,
  LogLevel,
  mergeRunResults,
  ok,
  err,
  type Result,
  updateTimingData,
  readTimingData,
  writeTimingData,
  DEFAULT_TIMING_DATA_PATH,
} from '@sorry-currents/core';

const DEFAULT_INPUT_DIR = '.sorry-currents/shards';
const DEFAULT_OUTPUT_DIR = '.sorry-currents';

interface MergeOptions {
  readonly input: string;
  readonly output: string;
  readonly verbose?: boolean;
}

/**
 * Read and validate all shard result JSON files from a directory.
 */
async function readShardResults(
  inputDir: string,
): Promise<Result<RunResult[]>> {
  const logger = new ConsoleLogger(LogLevel.INFO);

  let files: string[];
  try {
    const entries = await readdir(inputDir, { recursive: true });
    files = entries
      .filter((f) => f.endsWith('.json') && f.includes('run-result'))
      .map((f) => join(inputDir, f));
  } catch (error) {
    return err(
      AppError.fileNotFound(inputDir),
    );
  }

  if (files.length === 0) {
    return err(
      new AppError(
        'FILE_NOT_FOUND' as never,
        `No shard result files found in ${inputDir}`,
        { inputDir },
      ),
    );
  }

  const results: RunResult[] = [];
  for (const file of files) {
    try {
      const raw = await readFile(file, 'utf-8');
      const parsed = JSON.parse(raw) as unknown;
      const validated = RunResultSchema.safeParse(parsed);

      if (!validated.success) {
        logger.warn('Skipping invalid shard result', {
          file,
          errors: validated.error.issues.length,
        });
        continue;
      }

      results.push(validated.data);
    } catch (error) {
      logger.warn('Failed to read shard result', {
        file,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (results.length === 0) {
    return err(
      new AppError(
        'SCHEMA_VALIDATION' as never,
        'No valid shard results found after validation',
        { inputDir, filesScanned: files.length },
      ),
    );
  }

  return ok(results);
}

export function registerMergeCommand(program: Command): void {
  program
    .command('merge')
    .description('Merge results from multiple shards into a single run result')
    .option(
      '--input <dir>',
      'Directory containing shard results',
      DEFAULT_INPUT_DIR,
    )
    .option(
      '--output <dir>',
      'Output directory',
      DEFAULT_OUTPUT_DIR,
    )
    .option('--verbose', 'Enable debug logging')
    .action(async (options: MergeOptions) => {
      const logger = new ConsoleLogger(
        options.verbose ? LogLevel.DEBUG : LogLevel.INFO,
      );

      logger.info('Merging shard results', { input: options.input });

      const readResult = await readShardResults(options.input);
      if (!readResult.ok) {
        logger.error(readResult.error.message, readResult.error.context);
        process.exit(2);
      }

      const shardResults = readResult.value;
      logger.info('Found shard results', { count: shardResults.length });

      const merged = mergeRunResults(shardResults);

      // Write merged result
      const { writeFile: fsWriteFile, mkdir } = await import('node:fs/promises');
      const { join: pathJoin } = await import('node:path');
      const outputPath = pathJoin(options.output, 'merged-run-result.json');
      await mkdir(options.output, { recursive: true });
      await fsWriteFile(outputPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');

      // Generate timing-data.json from merged results for next run's shard balancer
      const timingDataPath = pathJoin(options.output, 'timing-data.json');
      const existingTimingResult = await readTimingData(timingDataPath);
      const existingTiming = existingTimingResult.ok ? existingTimingResult.value : [];
      const updatedTiming = updateTimingData(existingTiming, merged.tests);
      const timingWriteResult = await writeTimingData(timingDataPath, updatedTiming);

      if (timingWriteResult.ok) {
        logger.info('Timing data generated', {
          path: timingDataPath,
          tests: updatedTiming.length,
        });
      } else {
        logger.warn('Failed to write timing data', timingWriteResult.error.context);
      }

      logger.info('Merge complete', {
        output: outputPath,
        totalTests: merged.totalTests,
        passed: merged.passedTests,
        failed: merged.failedTests,
        flaky: merged.flakyTests,
        status: merged.status,
      });
    });
}
