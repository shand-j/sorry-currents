import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Command } from 'commander';

import {
  type ShardTimingData,
  ConsoleLogger,
  LogLevel,
  readTimingData,
  DEFAULT_TIMING_DATA_PATH,
  formatDuration,
} from '@sorry-currents/core';

import {
  getStrategy,
  listStrategies,
  timingDataToEntries,
  type TestTimingEntry,
} from '@sorry-currents/shard-balancer';

/** Default estimated duration for tests with no history (30 seconds) */
const DEFAULT_TEST_DURATION = 30_000;

interface PlanOptions {
  readonly shards: string;
  readonly timing: string;
  readonly output?: string;
  readonly outputMatrix?: boolean;
  readonly strategy: string;
  readonly defaultTimeout: string;
  readonly verbose?: boolean;
}

export function registerPlanCommand(program: Command): void {
  program
    .command('plan')
    .description('Generate an optimized shard execution plan')
    .requiredOption('--shards <n>', 'Number of shards')
    .option(
      '--timing <path>',
      'Path to timing data',
      DEFAULT_TIMING_DATA_PATH,
    )
    .option('--output <path>', 'Write plan to file (default: stdout)')
    .option(
      '--output-matrix',
      'Output GitHub Actions matrix JSON to stdout',
    )
    .option(
      '--strategy <name>',
      `Balancing strategy: ${listStrategies().join(' | ')}`,
      'lpt',
    )
    .option(
      '--default-timeout <ms>',
      'Estimated duration for tests without history',
      String(DEFAULT_TEST_DURATION),
    )
    .option('--verbose', 'Enable debug logging')
    .action(async (options: PlanOptions) => {
      const logger = new ConsoleLogger(
        options.verbose ? LogLevel.DEBUG : LogLevel.INFO,
      );

      const shardCount = parseInt(options.shards, 10);
      if (!Number.isFinite(shardCount) || shardCount < 1) {
        logger.error('Invalid shard count', { value: options.shards });
        process.exit(2);
      }

      const defaultDuration = parseInt(options.defaultTimeout, 10) || DEFAULT_TEST_DURATION;

      // Read timing data
      const timingResult = await readTimingData(options.timing);
      if (!timingResult.ok) {
        logger.error(timingResult.error.message, timingResult.error.context);
        process.exit(2);
      }

      const timingData: ShardTimingData[] = timingResult.value;
      const isColdStart = timingData.length === 0;

      if (isColdStart) {
        logger.warn(
          'Cold start: no timing data found. Using default durations.',
        );
        logger.warn(
          'Smart balancing will activate after the first run generates timing data.',
        );
      } else {
        logger.info('Loaded timing data', {
          tests: timingData.length,
          path: options.timing,
        });
      }

      // Resolve strategy
      const strategy = getStrategy(options.strategy);
      if (!strategy) {
        logger.error('Unknown strategy', {
          value: options.strategy,
          available: listStrategies(),
        });
        process.exit(2);
      }

      // Convert timing data to entries
      let entries: TestTimingEntry[];
      if (isColdStart) {
        // Cold start: we have no test list. Output a simple matrix and let
        // Playwright's native --shard handle distribution.
        if (options.outputMatrix) {
          const matrix = {
            include: Array.from({ length: shardCount }, (_, i) => ({
              shardIndex: i + 1,
              shardTotal: shardCount,
            })),
          };
          process.stdout.write(JSON.stringify(matrix));

          // Set GitHub Actions output if running in CI
          if (process.env['GITHUB_OUTPUT']) {
            const { appendFile } = await import('node:fs/promises');
            await appendFile(
              process.env['GITHUB_OUTPUT'],
              `matrix=${JSON.stringify(matrix)}\n`,
            );
          }

          return;
        }

        // For non-matrix output, create placeholder entries
        entries = Array.from({ length: shardCount }, (_, i) => ({
          testId: `placeholder-${i}`,
          file: `shard-${i + 1}`,
          estimatedDuration: defaultDuration,
        }));
      } else {
        entries = timingDataToEntries(timingData, defaultDuration);
      }

      // Generate shard plan
      const plan = strategy.balance(entries, shardCount);

      logger.info('Shard plan generated', {
        strategy: strategy.name,
        shards: plan.shards.length,
        totalTests: plan.totalTests,
        maxShardDuration: formatDuration(plan.maxShardDuration),
        minShardDuration: formatDuration(plan.minShardDuration),
        improvement: plan.improvement !== undefined
          ? `${plan.improvement}%`
          : 'N/A',
      });

      const planJson = JSON.stringify(plan, null, 2) + '\n';

      // Output as GitHub Actions matrix
      if (options.outputMatrix) {
        const matrix = {
          include: plan.shards.map((shard) => ({
            shardIndex: shard.shardIndex,
            shardTotal: plan.shards.length,
          })),
        };
        process.stdout.write(JSON.stringify(matrix));

        // Set GitHub Actions output
        if (process.env['GITHUB_OUTPUT']) {
          const { appendFile } = await import('node:fs/promises');
          await appendFile(
            process.env['GITHUB_OUTPUT'],
            `matrix=${JSON.stringify(matrix)}\n`,
          );
        }

        // Also write the plan file for `run` to consume
        const planPath = options.output ?? join('.sorry-currents', 'shard-plan.json');
        const { mkdir } = await import('node:fs/promises');
        const { dirname } = await import('node:path');
        await mkdir(dirname(planPath), { recursive: true });
        await writeFile(planPath, planJson, 'utf-8');

        return;
      }

      // Write to file or stdout
      if (options.output) {
        const { mkdir } = await import('node:fs/promises');
        const { dirname } = await import('node:path');
        await mkdir(dirname(options.output), { recursive: true });
        await writeFile(options.output, planJson, 'utf-8');
        logger.info('Plan written', { path: options.output });
      } else {
        process.stdout.write(planJson);
      }
    });
}
