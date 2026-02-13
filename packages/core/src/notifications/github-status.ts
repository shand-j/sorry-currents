import type { RunResult } from '../schemas/index.js';
import { formatDuration } from '../utils/format-duration.js';

/**
 * GitHub commit status state values.
 */
type StatusState = 'pending' | 'success' | 'failure' | 'error';

/**
 * Payload for creating a GitHub commit status check.
 */
export interface GitHubStatusPayload {
  readonly owner: string;
  readonly repo: string;
  readonly sha: string;
  readonly state: StatusState;
  readonly description: string;
  readonly context: string;
  readonly targetUrl?: string;
}

/**
 * Options for building a GitHub commit status.
 */
export interface GitHubStatusOptions {
  readonly runResult: RunResult;
  readonly owner: string;
  readonly repo: string;
  readonly reportUrl?: string;
}

/** Status context identifier — used to find and update existing statuses */
const STATUS_CONTEXT = 'sorry-currents';

/**
 * Build a GitHub commit status payload.
 * Pure function — no I/O.
 */
export function buildGitHubStatusPayload(options: GitHubStatusOptions): GitHubStatusPayload {
  const { runResult, owner, repo, reportUrl } = options;

  const state: StatusState = runResult.status === 'passed' ? 'success' : 'failure';

  const passed = runResult.passedTests;
  const failed = runResult.failedTests;
  const flaky = runResult.flakyTests;
  const duration = formatDuration(runResult.duration);

  // GitHub status description is limited to 140 characters
  let description = `${passed} passed, ${failed} failed`;
  if (flaky > 0) {
    description += `, ${flaky} flaky`;
  }
  description += ` (${duration})`;

  if (description.length > 140) {
    description = description.slice(0, 137) + '...';
  }

  return {
    owner,
    repo,
    sha: runResult.git.commit,
    state,
    description,
    context: STATUS_CONTEXT,
    ...(reportUrl ? { targetUrl: reportUrl } : {}),
  };
}
