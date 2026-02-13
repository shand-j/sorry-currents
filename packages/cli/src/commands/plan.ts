import { writeFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

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
  calculateOptimalShardCount,
  type TestTimingEntry,
} from '@sorry-currents/shard-balancer';

/** Default estimated duration for tests with no history (30 seconds) */
const DEFAULT_TEST_DURATION = 30_000;

/** Maximum number of shards when auto-calculating */
const DEFAULT_MAX_SHARDS = 10;

interface PlanOptions {
  readonly shards?: string;
  readonly targetDuration?: string;
  readonly maxShards?: string;
  readonly riskFactor?: string;
  readonly timing: string;
  readonly testDir?: string;
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
    .option('--shards <n>', 'Number of shards (overrides --target-duration)')
    .option(
      '--target-duration <seconds>',
      'Target wall-clock time per shard — auto-calculates shard count',
    )
    .option(
      '--max-shards <n>',
      'Maximum number of shards when using --target-duration',
      String(DEFAULT_MAX_SHARDS),
    )
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
      '--test-dir <path>',
      'Directory to scan for spec files (merges with timing data to discover new tests)',
    )
    .option(
      '--default-timeout <ms>',
      'Estimated duration for tests without history',
      String(DEFAULT_TEST_DURATION),
    )
    .option(
      '--risk-factor <k>',
      'Variance padding multiplier (0=average only, 1=+1 stddev, 2=+2 stddev)',
      '1',
    )
    .option('--verbose', 'Enable debug logging')
    .action(async (options: PlanOptions) => {
      const logger = new ConsoleLogger(
        options.verbose ? LogLevel.DEBUG : LogLevel.INFO,
      );

      const maxShards = parseInt(options.maxShards ?? String(DEFAULT_MAX_SHARDS), 10);
      const targetDurationMs = options.targetDuration
        ? parseFloat(options.targetDuration) * 1000
        : undefined;

      // Validate that at least one shard sizing option is provided
      if (!options.shards && !options.targetDuration) {
        logger.error(
          'Either --shards or --target-duration is required',
          { hint: 'Use --target-duration 30 for auto-calculation or --shards 3 for a fixed count' },
        );
        process.exit(2);
      }

      if (targetDurationMs !== undefined && (targetDurationMs <= 0 || !Number.isFinite(targetDurationMs))) {
        logger.error('Invalid target duration', { value: options.targetDuration });
        process.exit(2);
      }

      const defaultDuration = parseInt(options.defaultTimeout, 10) || DEFAULT_TEST_DURATION;

      // Parse risk factor for variance-aware balancing
      const riskFactor = parseFloat(options.riskFactor ?? '1');
      if (!Number.isFinite(riskFactor) || riskFactor < 0) {
        logger.error('Invalid risk factor — must be a non-negative number', { value: options.riskFactor });
        process.exit(2);
      }

      // Read timing data
      const timingResult = await readTimingData(options.timing);
      if (!timingResult.ok) {
        logger.error(timingResult.error.message, timingResult.error.context);
        process.exit(2);
      }

      const timingData: ShardTimingData[] = timingResult.value;
      const isColdStart = timingData.length === 0;

      // Determine shard count
      let shardCount: number;
      if (options.shards) {
        // Explicit override always wins
        shardCount = parseInt(options.shards, 10);
        if (!Number.isFinite(shardCount) || shardCount < 1) {
          logger.error('Invalid shard count', { value: options.shards });
          process.exit(2);
        }
      } else if (targetDurationMs !== undefined) {
        if (isColdStart) {
          // No timing data — fall back to max-shards
          shardCount = maxShards;
          logger.warn(
            'Cold start with --target-duration — using --max-shards as fallback until timing data is available',
            { maxShards },
          );
        } else {
          const entries = timingDataToEntries(timingData, defaultDuration, riskFactor);
          shardCount = calculateOptimalShardCount(entries, targetDurationMs, maxShards);
          logger.info('Auto-calculated shard count', {
            shardCount,
            targetDuration: `${options.targetDuration}s`,
            maxShards,
          });
        }
      } else {
        // Should be unreachable due to earlier validation
        shardCount = 1;
      }

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
        if (riskFactor > 0) {
          logger.info('Variance-aware balancing enabled', { riskFactor });
        }
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
        // Cold start: we have no test list.
        // If --test-dir is provided, discover files and create entries so the
        // balancer can distribute them properly even without timing data.
        if (options.testDir) {
          const discoveredFiles = await discoverTestFiles(options.testDir);
          entries = discoveredFiles.map(file => ({
            testId: `discovered:${file}`,
            file,
            estimatedDuration: defaultDuration,
          }));
          logger.info('Cold start — discovered test files from disk', {
            files: discoveredFiles.length,
            defaultDuration: formatDuration(defaultDuration),
          });
          // Recalculate shard count using discovered file count
          if (!options.shards && targetDurationMs !== undefined) {
            shardCount = calculateOptimalShardCount(entries, targetDurationMs, maxShards);
            logger.info('Auto-calculated shard count from discovered files', { shardCount });
          }
        } else if (options.outputMatrix) {
          // No --test-dir, output simple matrix for native Playwright sharding
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

          // Write a cold-start shard plan so downstream jobs can download it.
          // The run command detects empty test lists and falls back to native sharding.
          const coldPlan = {
            shards: Array.from({ length: shardCount }, (_, i) => ({
              shardIndex: i + 1,
              tests: [] as string[],
              estimatedDuration: 0,
            })),
            totalTests: 0,
            maxShardDuration: 0,
            minShardDuration: 0,
          };
          const planPath = options.output ?? join('.sorry-currents', 'shard-plan.json');
          const { mkdir } = await import('node:fs/promises');
          const { dirname } = await import('node:path');
          await mkdir(dirname(planPath), { recursive: true });
          await writeFile(planPath, JSON.stringify(coldPlan, null, 2) + '\n', 'utf-8');
          logger.info('Cold start shard plan written', { path: planPath });

          return;
        } else {
          // For non-matrix output, create placeholder entries
          entries = Array.from({ length: shardCount }, (_, i) => ({
            testId: `placeholder-${i}`,
            file: `shard-${i + 1}`,
            estimatedDuration: defaultDuration,
          }));
        }
      } else {
        entries = timingDataToEntries(timingData, defaultDuration, riskFactor);

        // Discover test files from disk and merge with timing data.
        // Any spec file not in timing data gets defaultDuration so new files are never silently dropped.
        if (options.testDir) {
          const discoveredFiles = await discoverTestFiles(options.testDir);
          const knownFiles = new Set(entries.map(e => e.file));
          let newFileCount = 0;
          for (const file of discoveredFiles) {
            if (!knownFiles.has(file)) {
              entries.push({
                testId: `discovered:${file}`,
                file,
                estimatedDuration: defaultDuration,
              });
              newFileCount++;
            }
          }
          if (newFileCount > 0) {
            logger.info('Discovered new test files not in timing data', {
              newFiles: newFileCount,
              totalFiles: discoveredFiles.length,
              defaultDuration: formatDuration(defaultDuration),
            });
            // Recalculate shard count if auto-calculating
            if (!options.shards && targetDurationMs !== undefined) {
              shardCount = calculateOptimalShardCount(entries, targetDurationMs, maxShards);
              logger.info('Recalculated shard count after file discovery', { shardCount });
            }
          }
        }
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

/**
 * Recursively discover test spec files in a directory.
 * Returns relative paths matching *.spec.ts / *.test.ts patterns.
 */
async function discoverTestFiles(dirPath: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        await walk(fullPath);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith('.spec.ts') || entry.name.endsWith('.test.ts'))
      ) {
        // Use path relative to cwd, matching Playwright's file references
        results.push(relative(process.cwd(), fullPath));
      }
    }
  }

  await walk(dirPath);
  return results.sort();
}
