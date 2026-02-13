import type { TestResult } from '../schemas/test-result.js';

/**
 * Detect whether a test is flaky: it passed but required retries.
 * A test that ultimately passes after one or more retry attempts is flaky.
 */
export function detectFlaky(testResult: Pick<TestResult, 'status' | 'retries'>): boolean {
  return testResult.status === 'passed' && testResult.retries > 0;
}
