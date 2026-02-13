import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

import type { Command } from 'commander';

import {
  ConsoleLogger,
  LogLevel,
  ShardPlanSchema,
  type ShardPlan,
  AppError,
  formatDuration,
  readTimingData,
  writeTimingData,
  updateTimingData,
  RunResultSchema,
  DEFAULT_TIMING_DATA_PATH,
} from '@sorry-currents/core';

interface RunOptions {
  readonly shardPlan?: string;
  readonly shardIndex?: string;
  readonly runId?: string;
  readonly verbose?: boolean;
}

/**
 * Read and validate a shard plan from a JSON file.
 */
async function loadShardPlan(path: string): Promise<ShardPlan> {
  const raw = await readFile(path, 'utf-8');
  const parsed = JSON.parse(raw) as unknown;
  const validated = ShardPlanSchema.parse(parsed);
  return validated;
}

/**
 * Spawn Playwright with the correct test files for a given shard.
 * Returns the exit code of the Playwright process.
 */
function runPlaywright(
  testFiles: readonly string[],
  runId: string | undefined,
  passthroughArgs: readonly string[],
): Promise<number> {
  return new Promise((resolve) => {
    const args = ['playwright', 'test', ...testFiles, ...passthroughArgs];

    // If a run ID is set, pass it to the reporter via env
    const env = { ...process.env };
    if (runId) {
      env['SORRY_CURRENTS_RUN_ID'] = runId;
    }

    const child = spawn('npx', args, {
      stdio: 'inherit',
      env,
      shell: true,
    });

    child.on('close', (code) => {
      resolve(code ?? 1);
    });

    child.on('error', () => {
      resolve(2);
    });
  });
}

/**
 * Run Playwright in native shard mode (cold start fallback).
 */
function runPlaywrightNativeShard(
  shardIndex: number,
  shardTotal: number,
  runId: string | undefined,
  passthroughArgs: readonly string[],
): Promise<number> {
  return new Promise((resolve) => {
    const args = [
      'playwright',
      'test',
      `--shard=${shardIndex}/${shardTotal}`,
      ...passthroughArgs,
    ];

    const env = { ...process.env };
    if (runId) {
      env['SORRY_CURRENTS_RUN_ID'] = runId;
    }

    const child = spawn('npx', args, {
      stdio: 'inherit',
      env,
      shell: true,
    });

    child.on('close', (code) => {
      resolve(code ?? 1);
    });

    child.on('error', () => {
      resolve(2);
    });
  });
}

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Run Playwright tests with sorry-currents reporter auto-configured')
    .option('--shard-plan <path>', 'Use a generated shard plan')
    .option('--shard-index <n>', 'Which shard index to execute (1-based)')
    .option('--run-id <id>', 'Explicit run ID (default: auto-detect from CI)')
    .option('--verbose', 'Enable debug logging')
    .allowUnknownOption(true)
    .action(async (options: RunOptions, cmd) => {
      const logger = new ConsoleLogger(
        options.verbose ? LogLevel.DEBUG : LogLevel.INFO,
      );

      // Collect passthrough args for Playwright (everything after --)
      const passthroughArgs = cmd.args ?? [];

      const shardIndex = options.shardIndex
        ? parseInt(options.shardIndex, 10)
        : undefined;

      if (options.shardPlan) {
        // Smart shard mode: read plan and run assigned tests
        if (!existsSync(options.shardPlan)) {
          logger.error('Shard plan not found', { path: options.shardPlan });
          process.exit(2);
        }

        if (shardIndex === undefined) {
          logger.error('--shard-index is required when using --shard-plan');
          process.exit(2);
        }

        let plan: ShardPlan;
        try {
          plan = await loadShardPlan(options.shardPlan);
        } catch (error) {
          logger.error('Failed to load shard plan', {
            path: options.shardPlan,
            error: error instanceof Error ? error.message : String(error),
          });
          process.exit(2);
          return; // unreachable, but satisfies TypeScript
        }

        const assignment = plan.shards.find((s) => s.shardIndex === shardIndex);
        if (!assignment) {
          // Check if this is a cold start plan (no real test assignments)
          // Fall back to native sharding
          logger.info('No assignment found for shard index, using native sharding', {
            shardIndex,
            availableShards: plan.shards.map((s) => s.shardIndex),
          });

          const exitCode = await runPlaywrightNativeShard(
            shardIndex,
            plan.shards.length,
            options.runId,
            passthroughArgs,
          );

          await postRunTimingUpdate(logger);
          process.exit(exitCode);
          return;
        }

        if (assignment.tests.length === 0) {
          logger.info('No tests assigned to this shard', { shardIndex });
          process.exit(0);
          return;
        }

        logger.info('Running shard', {
          shardIndex,
          tests: assignment.tests.length,
          estimatedDuration: formatDuration(assignment.estimatedDuration),
        });

        const exitCode = await runPlaywright(
          assignment.tests,
          options.runId,
          passthroughArgs,
        );

        await postRunTimingUpdate(logger);

        // Exit code 1 = test failures (expected), 2+ = sorry-currents error
        process.exit(exitCode);
      } else if (shardIndex !== undefined) {
        // Native shard mode (no plan file)
        const shardTotal = parseInt(
          process.env['SORRY_CURRENTS_SHARD_TOTAL'] ?? '1',
          10,
        );

        logger.info('Running with native Playwright sharding', {
          shardIndex,
          shardTotal,
        });

        const exitCode = await runPlaywrightNativeShard(
          shardIndex,
          shardTotal,
          options.runId,
          passthroughArgs,
        );

        await postRunTimingUpdate(logger);
        process.exit(exitCode);
      } else {
        // No sharding — run all tests
        logger.info('Running all tests (no sharding)');

        const exitCode = await runPlaywright(
          [],
          options.runId,
          passthroughArgs,
        );

        await postRunTimingUpdate(logger);
        process.exit(exitCode);
      }
    });
}

/**
 * After a test run, update the timing data file with new results.
 * This is best-effort — failures are logged but don't affect exit code.
 */
async function postRunTimingUpdate(logger: { warn: (msg: string, ctx?: Record<string, unknown>) => void; info: (msg: string, ctx?: Record<string, unknown>) => void }): Promise<void> {
  try {
    const runResultPath = join('.sorry-currents', 'runs');

    // Find the most recent run-result.json
    const { readdir } = await import('node:fs/promises');
    if (!existsSync(runResultPath)) return;

    const runDirs = await readdir(runResultPath);
    if (runDirs.length === 0) return;

    // Sort to get most recent
    const latestDir = runDirs.sort().at(-1);
    if (!latestDir) return;

    const resultFile = join(runResultPath, latestDir, 'run-result.json');
    if (!existsSync(resultFile)) return;

    const raw = await readFile(resultFile, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    const validated = RunResultSchema.safeParse(parsed);

    if (!validated.success) {
      logger.warn('Could not parse run result for timing update', {
        path: resultFile,
      });
      return;
    }

    const runResult = validated.data;

    // Read existing timing data
    const existingResult = await readTimingData(DEFAULT_TIMING_DATA_PATH);
    const existing = existingResult.ok ? existingResult.value : [];

    // Merge new data
    const updated = updateTimingData(existing, runResult.tests);

    // Write back
    const writeResult = await writeTimingData(DEFAULT_TIMING_DATA_PATH, updated);
    if (writeResult.ok) {
      logger.info('Timing data updated', {
        tests: updated.length,
        path: DEFAULT_TIMING_DATA_PATH,
      });
    } else {
      logger.warn('Failed to write timing data', writeResult.error.context);
    }
  } catch (error) {
    // Non-fatal — timing data update is best-effort
    logger.warn('Failed to update timing data', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
