import { resolve } from 'node:path';

import type { Command } from 'commander';

import {
  ConsoleLogger,
  LogLevel,
  readHistory,
  DEFAULT_HISTORY_PATH,
  formatDuration,
  type TestHistory,
} from '@sorry-currents/core';

interface HistoryOptions {
  readonly flaky?: boolean;
  readonly slow?: boolean;
  readonly failing?: boolean;
  readonly limit?: string;
  readonly format?: string;
  readonly input?: string;
  readonly verbose?: boolean;
}

export function registerHistoryCommand(program: Command): void {
  program
    .command('history')
    .description('View test history and analytics from the terminal')
    .option('--flaky', 'Show flakiest tests (sorted by flakiness rate)')
    .option('--slow', 'Show slowest tests (sorted by p95 duration)')
    .option('--failing', 'Show most failing tests')
    .option('--limit <n>', 'Number of results to show', '20')
    .option('--format <type>', 'Output format: table | json', 'table')
    .option('--input <path>', 'Path to history file', DEFAULT_HISTORY_PATH)
    .option('--verbose', 'Enable debug logging')
    .action(async (options: HistoryOptions) => {
      const logger = new ConsoleLogger(
        options.verbose ? LogLevel.DEBUG : LogLevel.INFO,
      );

      const historyPath = resolve(options.input ?? DEFAULT_HISTORY_PATH);
      const historyDir = resolve(historyPath, '..');

      // Read from history.json in the same directory as default timing data
      const result = await readHistory(
        historyPath.endsWith('.json')
          ? historyPath
          : resolve(historyDir, 'history.json'),
      );

      if (!result.ok) {
        logger.error('Failed to read history data', {
          path: historyPath,
          error: result.error.message,
        });
        process.exit(2);
        return;
      }

      const history = result.value;

      if (history.length === 0) {
        logger.info('No history data found. Run tests with sorry-currents reporter and generate a report first.');
        return;
      }

      const limit = parseInt(options.limit ?? '20', 10);
      const format = options.format ?? 'table';

      // Default: show flaky if no specific filter
      const showFlaky = options.flaky || (!options.slow && !options.failing);

      let sorted: TestHistory[];
      let heading: string;

      if (options.slow) {
        sorted = [...history].sort((a, b) => b.p95Duration - a.p95Duration);
        heading = 'Slowest Tests (by p95 duration)';
      } else if (options.failing) {
        sorted = [...history].sort((a, b) => b.failureRate - a.failureRate);
        heading = 'Most Failing Tests';
      } else {
        sorted = [...history].sort((a, b) => b.flakinessRate - a.flakinessRate);
        heading = 'Flakiest Tests';
      }

      const items = sorted.slice(0, limit);

      if (format === 'json') {
        process.stdout.write(JSON.stringify(items, null, 2) + '\n');
        return;
      }

      // Table output
      logger.info(`\n${heading} (${Math.min(limit, history.length)} of ${history.length})\n`);

      if (options.slow) {
        renderSlowTable(items);
      } else if (options.failing) {
        renderFailingTable(items);
      } else {
        renderFlakyTable(items);
      }
    });
}

function renderFlakyTable(items: readonly TestHistory[]): void {
  const header = padRow(['Flakiness %', 'Flaky/Total', 'Test', 'File']);
  const sep = '-'.repeat(header.length);
  process.stderr.write(header + '\n' + sep + '\n');
  for (const h of items) {
    if (h.flakinessRate === 0 && h.flakyCount === 0) continue;
    process.stderr.write(
      padRow([
        `${(h.flakinessRate * 100).toFixed(1)}%`,
        `${h.flakyCount}/${h.totalRuns}`,
        truncate(h.title, 50),
        truncate(h.file, 40),
      ]) + '\n',
    );
  }
}

function renderFailingTable(items: readonly TestHistory[]): void {
  const header = padRow(['Failure %', 'Fail/Total', 'Test', 'File']);
  const sep = '-'.repeat(header.length);
  process.stderr.write(header + '\n' + sep + '\n');
  for (const h of items) {
    if (h.failureRate === 0 && h.failCount === 0) continue;
    process.stderr.write(
      padRow([
        `${(h.failureRate * 100).toFixed(1)}%`,
        `${h.failCount}/${h.totalRuns}`,
        truncate(h.title, 50),
        truncate(h.file, 40),
      ]) + '\n',
    );
  }
}

function renderSlowTable(items: readonly TestHistory[]): void {
  const header = padRow(['p95', 'Avg', 'Runs', 'Test', 'File']);
  const sep = '-'.repeat(header.length);
  process.stderr.write(header + '\n' + sep + '\n');
  for (const h of items) {
    process.stderr.write(
      padRow([
        formatDuration(h.p95Duration),
        formatDuration(h.avgDuration),
        String(h.totalRuns),
        truncate(h.title, 45),
        truncate(h.file, 35),
      ]) + '\n',
    );
  }
}

function padRow(cols: string[]): string {
  const widths = [12, 12, 50, 40, 35];
  return cols
    .map((c, i) => {
      const w = widths[i] ?? 20;
      return c.length > w ? c.slice(0, w) : c.padEnd(w);
    })
    .join('  ');
}

function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen - 1) + '…' : s;
}
