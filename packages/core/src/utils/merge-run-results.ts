import type { RunResult } from '../schemas/run-result.js';
import type { TestResult } from '../schemas/test-result.js';

/**
 * Merge multiple shard RunResults into a single unified RunResult.
 * Combines test arrays, recalculates summary counts, and picks the worst status.
 */
export function mergeRunResults(results: readonly RunResult[]): RunResult {
  if (results.length === 0) {
    throw new Error('Cannot merge zero RunResults — this is a programming error');
  }

  // Use the first result as the base for metadata
  const first = results[0]!;
  const allTests: TestResult[] = results.flatMap((r) => r.tests);

  const passedTests = allTests.filter((t) => t.status === 'passed' && !t.isFlaky).length;
  const failedTests = allTests.filter((t) => t.status === 'failed').length;
  const skippedTests = allTests.filter((t) => t.status === 'skipped').length;
  const flakyTests = allTests.filter((t) => t.isFlaky).length;
  const timedOutTests = allTests.filter((t) => t.status === 'timedOut').length;

  const status = resolveRunStatus(results);
  const totalDuration = Math.max(...results.map((r) => r.duration));

  return {
    id: first.id,
    timestamp: first.timestamp,
    duration: totalDuration,
    status,
    totalTests: allTests.length,
    passedTests,
    failedTests: failedTests + timedOutTests,
    skippedTests,
    flakyTests,
    shardCount: results.length,
    shardIndex: undefined,
    tests: allTests,
    environment: first.environment,
    git: first.git,
    config: first.config,
  };
}

/**
 * Resolve the overall run status from multiple shard statuses.
 * Priority: interrupted > timedOut > failed > passed
 */
function resolveRunStatus(
  results: readonly RunResult[],
): RunResult['status'] {
  const statuses = new Set(results.map((r) => r.status));
  if (statuses.has('interrupted')) return 'interrupted';
  if (statuses.has('timedOut')) return 'timedOut';
  if (statuses.has('failed')) return 'failed';
  return 'passed';
}
