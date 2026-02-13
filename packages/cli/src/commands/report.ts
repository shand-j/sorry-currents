import { readFile } from 'node:fs/promises';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { Command } from 'commander';

import {
  ConsoleLogger,
  LogLevel,
  RunResultSchema,
  type RunResult,
  readHistory,
  writeHistory,
  updateHistory,
  DEFAULT_HISTORY_PATH,
  formatDuration,
} from '@sorry-currents/core';

import { ReportBuilder } from '@sorry-currents/html-report';

interface ReportOptions {
  readonly format?: string;
  readonly input?: string;
  readonly output?: string;
  readonly history?: boolean;
  readonly open?: boolean;
  readonly verbose?: boolean;
}

export function registerReportCommand(program: Command): void {
  program
    .command('report')
    .description('Generate reports from run results')
    .option('--format <type>', 'Report format: html | json | markdown', 'html')
    .option('--input <dir>', 'Results directory', '.sorry-currents')
    .option('--output <dir>', 'Report output directory', '.sorry-currents/report')
    .option('--history', 'Include historical comparison data')
    .option('--open', 'Open HTML report in browser after generation')
    .option('--verbose', 'Enable debug logging')
    .action(async (options: ReportOptions) => {
      const logger = new ConsoleLogger(
        options.verbose ? LogLevel.DEBUG : LogLevel.INFO,
      );

      const inputDir = resolve(options.input ?? '.sorry-currents');
      const outputDir = resolve(options.output ?? '.sorry-currents/report');

      // Find the merged run result
      const mergedPath = join(inputDir, 'merged-run-result.json');
      if (!existsSync(mergedPath)) {
        logger.error('No merged run result found. Run "sorry-currents merge" first.', {
          expected: mergedPath,
        });
        process.exit(2);
      }

      let runResult: RunResult;
      try {
        const raw = await readFile(mergedPath, 'utf-8');
        const parsed = JSON.parse(raw) as unknown;
        runResult = RunResultSchema.parse(parsed);
      } catch (error) {
        logger.error('Failed to load run result', {
          path: mergedPath,
          error: error instanceof Error ? error.message : String(error),
        });
        process.exit(2);
        return;
      }

      logger.info('Loaded run result', {
        tests: runResult.totalTests,
        status: runResult.status,
        duration: formatDuration(runResult.duration),
      });

      // Update history with this run's data
      const historyPath = join(inputDir, 'history.json');
      const existingHistory = await readHistory(historyPath);
      const historyData = existingHistory.ok ? existingHistory.value : [];
      const updatedHistory = updateHistory(historyData, runResult.tests);

      // Persist updated history
      const writeResult = await writeHistory(historyPath, updatedHistory);
      if (writeResult.ok) {
        logger.debug('History updated', { tests: updatedHistory.length, path: historyPath });
      } else {
        logger.warn('Failed to write history', writeResult.error.context);
      }

      const format = options.format ?? 'html';

      if (format === 'json') {
        // JSON output to stdout
        const output = JSON.stringify(runResult, null, 2);
        process.stdout.write(output + '\n');
        logger.info('JSON report written to stdout');
        return;
      }

      if (format === 'markdown') {
        const md = generateMarkdownReport(runResult);
        await mkdir(outputDir, { recursive: true });
        const mdPath = join(outputDir, 'report.md');
        await writeFile(mdPath, md, 'utf-8');
        logger.info('Markdown report generated', { path: mdPath });
        return;
      }

      // HTML report (default)
      const builder = new ReportBuilder()
        .withRunResult(runResult)
        .withTitle(`Test Report — ${runResult.git?.branch ?? 'unknown branch'}`);

      if (options.history && updatedHistory.length > 0) {
        builder.withHistory(updatedHistory);
      }

      const result = builder.build();
      if (!result.ok) {
        logger.error('Failed to build HTML report', { error: result.error.message });
        process.exit(2);
        return;
      }

      await mkdir(outputDir, { recursive: true });
      const htmlPath = join(outputDir, 'index.html');
      await writeFile(htmlPath, result.value, 'utf-8');

      logger.info('HTML report generated', {
        path: htmlPath,
        size: `${Math.round(result.value.length / 1024)}KB`,
      });

      if (options.open) {
        const { exec } = await import('node:child_process');
        const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
        exec(`${cmd} ${htmlPath}`);
      }
    });
}

/**
 * Generate a simple markdown report for embedding in PRs/issues.
 */
function generateMarkdownReport(runResult: RunResult): string {
  const lines: string[] = [
    `# Test Report`,
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| **Status** | ${runResult.status} |`,
    `| **Total** | ${runResult.totalTests} |`,
    `| **Passed** | ${runResult.passedTests} |`,
    `| **Failed** | ${runResult.failedTests} |`,
    `| **Flaky** | ${runResult.flakyTests} |`,
    `| **Skipped** | ${runResult.skippedTests} |`,
    `| **Duration** | ${formatDuration(runResult.duration)} |`,
    `| **Shards** | ${runResult.shardCount} |`,
    '',
  ];

  const failed = runResult.tests.filter((t) => t.status === 'failed' || t.status === 'timedOut');
  if (failed.length > 0) {
    lines.push('## Failed Tests', '');
    lines.push('| Test | File | Duration |');
    lines.push('|------|------|----------|');
    for (const t of failed) {
      lines.push(`| ${t.title} | ${t.file} | ${formatDuration(t.duration)} |`);
    }
    lines.push('');
  }

  const flaky = runResult.tests.filter((t) => t.isFlaky);
  if (flaky.length > 0) {
    lines.push('## Flaky Tests', '');
    lines.push('| Test | File | Retries |');
    lines.push('|------|------|---------|');
    for (const t of flaky) {
      lines.push(`| ${t.title} | ${t.file} | ${t.retries} |`);
    }
    lines.push('');
  }

  lines.push('---', '*Generated by [sorry-currents](https://github.com/nicholasgriffintn/sorry-currents)*', '');
  return lines.join('\n');
}
