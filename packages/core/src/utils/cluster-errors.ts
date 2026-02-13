import { normalizeError } from './normalize-error.js';
import type { TestResult } from '../schemas/test-result.js';
import type { ErrorSummary } from '../schemas/test-history.js';

/**
 * A cluster of failures grouped by normalized error message.
 */
export interface ErrorCluster {
  /** Normalized error message (key for grouping) */
  readonly message: string;
  /** Number of tests with this error */
  readonly count: number;
  /** Test IDs that have this error */
  readonly testIds: readonly string[];
  /** Test files that have this error */
  readonly files: readonly string[];
  /** An example stack trace */
  readonly exampleStack?: string;
}

/**
 * Cluster test failures by normalized error message.
 * Groups all failing tests by their normalized error, so repeated failures
 * from the same root cause are presented together.
 *
 * Pure function — no side effects.
 */
export function clusterErrors(
  testResults: readonly TestResult[],
): ErrorCluster[] {
  const clusters = new Map<
    string,
    { testIds: Set<string>; files: Set<string>; exampleStack?: string }
  >();

  for (const test of testResults) {
    if (test.status !== 'failed' && test.status !== 'timedOut') {
      continue;
    }

    for (const error of test.errors) {
      const normalized = normalizeError(error.message);

      const existing = clusters.get(normalized);
      if (existing) {
        existing.testIds.add(test.id);
        existing.files.add(test.file);
        if (error.stack) {
          existing.exampleStack = error.stack;
        }
      } else {
        clusters.set(normalized, {
          testIds: new Set([test.id]),
          files: new Set([test.file]),
          exampleStack: error.stack,
        });
      }
    }
  }

  return [...clusters.entries()]
    .map(([message, data]) => ({
      message,
      count: data.testIds.size,
      testIds: [...data.testIds],
      files: [...data.files],
      exampleStack: data.exampleStack,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Convert ErrorCluster[] to ErrorSummary[] (for persistence in TestHistory).
 */
export function clustersToSummaries(
  clusters: readonly ErrorCluster[],
  limit: number = 10,
): ErrorSummary[] {
  const now = new Date().toISOString();
  return clusters.slice(0, limit).map((c) => ({
    message: c.message,
    count: c.count,
    lastSeen: now,
    exampleStack: c.exampleStack,
  }));
}
