import type { RunResult } from '../schemas/index.js';

/**
 * Payload for a generic webhook POST.
 */
export interface WebhookPayload {
  readonly event: 'test-run-completed';
  readonly timestamp: string;
  readonly result: WebhookResultSummary;
  readonly git: WebhookGitInfo;
  readonly tests: readonly WebhookTestSummary[];
}

interface WebhookResultSummary {
  readonly id: string;
  readonly status: string;
  readonly duration: number;
  readonly totalTests: number;
  readonly passedTests: number;
  readonly failedTests: number;
  readonly flakyTests: number;
  readonly skippedTests: number;
  readonly shardCount: number;
}

interface WebhookGitInfo {
  readonly branch: string;
  readonly commit: string;
  readonly author: string;
  readonly commitMessage: string;
}

interface WebhookTestSummary {
  readonly id: string;
  readonly file: string;
  readonly title: string;
  readonly status: string;
  readonly duration: number;
  readonly isFlaky: boolean;
  readonly errors: readonly string[];
}

/**
 * Build a generic webhook payload from run results.
 * Pure function — sends a normalized subset of the RunResult.
 */
export function buildWebhookPayload(runResult: RunResult): WebhookPayload {
  return {
    event: 'test-run-completed',
    timestamp: runResult.timestamp,
    result: {
      id: runResult.id,
      status: runResult.status,
      duration: runResult.duration,
      totalTests: runResult.totalTests,
      passedTests: runResult.passedTests,
      failedTests: runResult.failedTests,
      flakyTests: runResult.flakyTests,
      skippedTests: runResult.skippedTests,
      shardCount: runResult.shardCount,
    },
    git: {
      branch: runResult.git.branch,
      commit: runResult.git.commit,
      author: runResult.git.author,
      commitMessage: runResult.git.commitMessage,
    },
    tests: runResult.tests.map((t) => ({
      id: t.id,
      file: t.file,
      title: t.title,
      status: t.status,
      duration: t.duration,
      isFlaky: t.isFlaky,
      errors: t.errors.map((e) => e.message),
    })),
  };
}
