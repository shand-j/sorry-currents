import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

import {
  type Logger,
  type TestResult,
  type RunResult,
  type ReporterOptions,
  ReporterOptionsSchema,
  ConsoleLogger,
  LogLevel,
  generateTestId,
  detectFlaky,
  detectCI,
} from '@sorry-currents/core';

/**
 * Playwright uses lowercase 'timedout', but our schema uses camelCase 'timedOut'.
 * Map Playwright statuses to our canonical status values.
 */
const PW_STATUS_MAP: Record<string, TestResult['status']> = {
  passed: 'passed',
  failed: 'failed',
  timedout: 'timedOut',
  timedOut: 'timedOut',
  skipped: 'skipped',
  interrupted: 'interrupted',
} as const;

const PW_RUN_STATUS_MAP: Record<string, RunResult['status']> = {
  passed: 'passed',
  failed: 'failed',
  timedout: 'timedOut',
  timedOut: 'timedOut',
  interrupted: 'interrupted',
} as const;

function mapPlaywrightStatus(status: string): TestResult['status'] {
  return PW_STATUS_MAP[status] ?? 'failed';
}

function mapPlaywrightRunStatus(status: string): RunResult['status'] {
  return PW_RUN_STATUS_MAP[status] ?? 'failed';
}

import type {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult as PWTestResult,
  FullResult,
} from '@playwright/test/reporter';

/**
 * Custom Playwright Reporter that captures test execution data
 * and writes it to the sorry-currents output directory.
 *
 * Key behavioral requirements:
 * - Crash-resilient: writes each test result immediately in onTestEnd
 * - Shard-aware: detects shard index and writes shard-specific output
 * - Non-blocking: reporter must never slow down or crash test execution
 * - All errors are swallowed and logged as warnings
 */
class SorryCurrentsReporter implements Reporter {
  private readonly options: ReporterOptions;
  private readonly logger: Logger;
  private readonly testResults: TestResult[] = [];
  /** Track the highest retry seen per test to deduplicate retry attempts */
  private readonly testRetryMap = new Map<string, TestResult>();
  private config: FullConfig | null = null;
  private suite: Suite | null = null;
  private startTime: string = '';
  private cachedRunId: string | null = null;
  private readonly writeQueue: Promise<void>[] = [];

  constructor(rawOptions: Record<string, unknown> = {}) {
    this.options = ReporterOptionsSchema.parse(rawOptions);
    this.logger = this.options.silent
      ? { debug() {}, info() {}, warn() {}, error() {} }
      : new ConsoleLogger(LogLevel.INFO);
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    this.suite = suite;
    this.startTime = new Date().toISOString();

    this.logger.info('sorry-currents reporter initialized', {
      outputDir: this.options.outputDir,
      totalTests: suite.allTests().length,
    });

    // Ensure output directories exist (fire-and-forget, non-blocking)
    const runsDir = this.getRunDir();
    const testsDir = join(runsDir, 'tests');
    this.enqueueWrite(mkdir(testsDir, { recursive: true }).then(() => {}));
  }

  onTestEnd(test: TestCase, result: PWTestResult): void {
    try {
      const testResult = this.mapTestResult(test, result);

      // Deduplicate retry attempts: Playwright calls onTestEnd for every attempt.
      // We keep only the latest attempt (highest retry count) per test ID.
      const existing = this.testRetryMap.get(testResult.id);
      if (existing && existing.retries >= testResult.retries) {
        // We already have a later or equal attempt — skip this one
        return;
      }
      this.testRetryMap.set(testResult.id, testResult);

      // Crash-resilient: write each test result immediately (overwrites previous attempt)
      const testFile = join(this.getRunDir(), 'tests', `${testResult.id}.json`);
      this.enqueueWrite(
        this.safeWriteJson(testFile, testResult),
      );
    } catch (error) {
      // Reporter must NEVER crash test execution
      this.logger.warn('Failed to process test result', {
        testTitle: test?.title ?? 'unknown',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Tell Playwright we don't print to stdio — prevents output interleaving */
  printsToStdio(): boolean {
    return false;
  }

  async onEnd(result: FullResult): Promise<void> {
    try {
      // Wait for all pending writes
      await Promise.allSettled(this.writeQueue);

      // Build deduplicated test results from the retry map
      this.testResults.length = 0;
      for (const testResult of this.testRetryMap.values()) {
        this.testResults.push(testResult);
      }

      const runResult = this.buildRunResult(result);
      const runDir = this.getRunDir();

      // Write the complete run result
      await this.safeWriteJson(join(runDir, 'run-result.json'), runResult);

      // If sharded, also write shard-specific file
      const shardInfo = this.getShardInfo();
      if (shardInfo) {
        const shardFile = `shard-${shardInfo.current}-of-${shardInfo.total}.json`;
        await this.safeWriteJson(join(runDir, shardFile), runResult);
      }

      this.logger.info('sorry-currents results written', {
        outputDir: runDir,
        totalTests: this.testResults.length,
        status: runResult.status,
      });
    } catch (error) {
      // Reporter must NEVER crash test execution
      this.logger.warn('Failed to write final results', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // --- Private helpers ---

  private mapTestResult(test: TestCase, result: PWTestResult): TestResult {
    const file = relative(
      this.config?.rootDir ?? process.cwd(),
      test.location.file,
    );
    const project = test.parent.project()?.name ?? '';

    return {
      id: generateTestId(file, test.title, project),
      file,
      title: test.titlePath().join(' > '),
      project,
      status: mapPlaywrightStatus(result.status),
      duration: result.duration,
      retries: result.retry,
      isFlaky: detectFlaky({ status: mapPlaywrightStatus(result.status), retries: result.retry }),
      errors: result.errors.map((e) => ({
        message: e.message ?? '',
        stack: e.stack,
        snippet: e.snippet,
        location: e.location
          ? {
              file: e.location.file,
              line: e.location.line,
              column: e.location.column,
            }
          : undefined,
      })),
      annotations: test.annotations.map((a) => ({
        type: a.type,
        description: a.description,
      })),
      tags: test.tags,
      attachments: result.attachments
        .filter((a) => a.path)
        .map((a) => ({
          name: a.name,
          contentType: a.contentType,
          path: a.path!,
        })),
      startedAt: new Date(result.startTime).toISOString(),
      workerId: result.workerIndex,
      shardIndex: this.getShardInfo()?.current,
    };
  }

  private buildRunResult(fullResult: FullResult): RunResult {
    const passedTests = this.testResults.filter(
      (t) => t.status === 'passed' && !t.isFlaky,
    ).length;
    const failedTests = this.testResults.filter(
      (t) => t.status === 'failed' || t.status === 'timedOut',
    ).length;
    const skippedTests = this.testResults.filter(
      (t) => t.status === 'skipped',
    ).length;
    const flakyTests = this.testResults.filter((t) => t.isFlaky).length;

    const shardInfo = this.getShardInfo();

    return {
      id: this.getRunId(),
      timestamp: this.startTime,
      duration: fullResult.duration,
      status: mapPlaywrightRunStatus(fullResult.status),
      totalTests: this.testResults.length,
      passedTests,
      failedTests,
      skippedTests,
      flakyTests,
      shardCount: shardInfo?.total ?? 1,
      shardIndex: shardInfo?.current,
      tests: this.testResults,
      environment: {
        os: process.platform,
        nodeVersion: process.version,
        playwrightVersion: this.config?.version ?? 'unknown',
        ci: detectCI(),
      },
      git: {
        branch: process.env['GITHUB_REF_NAME'] ?? process.env['CI_COMMIT_BRANCH'] ?? 'unknown',
        commit: process.env['GITHUB_SHA'] ?? process.env['CI_COMMIT_SHA'] ?? 'unknown',
        commitMessage: process.env['GITHUB_EVENT_HEAD_COMMIT_MESSAGE'] ?? '',
        author: process.env['GITHUB_ACTOR'] ?? process.env['GITLAB_USER_LOGIN'] ?? 'unknown',
      },
      config: {
        workers: this.config?.workers ?? 1,
        projects: this.config?.projects.map((p) => p.name) ?? [],
        retries: this.testResults[0]?.retries ?? 0,
        timeout: this.config?.projects[0]?.timeout ?? 30_000,
      },
    };
  }

  private getRunId(): string {
    // Cache the run ID so it doesn't change between onBegin/onTestEnd/onEnd
    if (this.cachedRunId) return this.cachedRunId;

    if (this.options.runId) {
      this.cachedRunId = this.options.runId;
      return this.cachedRunId;
    }

    // Auto-detect from CI environment
    // SORRY_CURRENTS_RUN_ID is set by the `sorry-currents run` command
    const ciRunId =
      process.env['SORRY_CURRENTS_RUN_ID'] ??
      process.env['GITHUB_RUN_ID'] ??
      process.env['CI_PIPELINE_ID'] ??
      process.env['BUILD_ID'];

    if (ciRunId) {
      this.cachedRunId = ciRunId;
      return this.cachedRunId;
    }

    // Fallback: timestamp-based ID for local runs
    this.cachedRunId = `local-${Date.now()}`;
    return this.cachedRunId;
  }

  private getRunDir(): string {
    return join(this.options.outputDir, 'runs', this.getRunId());
  }

  private getShardInfo(): { current: number; total: number } | null {
    const shard = this.config?.shard;
    if (!shard) return null;
    return { current: shard.current, total: shard.total };
  }

  private async safeWriteJson(filePath: string, data: unknown): Promise<void> {
    try {
      await mkdir(dirname(filePath), { recursive: true });
      const json = JSON.stringify(data, null, 2) + '\n';
      await writeFile(filePath, json, 'utf-8');
    } catch (error) {
      this.logger.warn('Failed to write file', {
        path: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private enqueueWrite(promise: Promise<void>): void {
    this.writeQueue.push(promise);
  }
}

// Default export required by Playwright's reporter API
export default SorryCurrentsReporter;

// Also export as named export for programmatic usage
export { SorryCurrentsReporter };
