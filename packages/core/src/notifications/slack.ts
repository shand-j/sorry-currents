import type { RunResult, TestResult } from '../schemas/index.js';
import { formatDuration } from '../utils/format-duration.js';

/**
 * Slack Block Kit payload structure for a test results notification.
 */
export interface SlackPayload {
  readonly text: string;
  readonly blocks: readonly SlackBlock[];
}

interface SlackBlock {
  readonly type: string;
  readonly text?: { readonly type: string; readonly text: string; readonly emoji?: boolean };
  readonly elements?: readonly SlackBlockElement[];
  readonly fields?: readonly SlackBlockField[];
}

interface SlackBlockElement {
  readonly type: string;
  readonly text: string;
}

interface SlackBlockField {
  readonly type: string;
  readonly text: string;
}

/**
 * Options for building a Slack notification payload.
 */
export interface SlackNotifyOptions {
  readonly runResult: RunResult;
  readonly reportUrl?: string;
}

/**
 * Build a Slack Block Kit payload from run results.
 * Pure function — no I/O.
 */
export function buildSlackPayload(options: SlackNotifyOptions): SlackPayload {
  const { runResult, reportUrl } = options;

  const statusEmoji = runResult.status === 'passed' ? ':white_check_mark:' : ':x:';
  const statusText = runResult.status === 'passed' ? 'Passed' : 'Failed';

  const fallbackText = `Test run ${statusText}: ${runResult.passedTests}/${runResult.totalTests} passed (${formatDuration(runResult.duration)})`;

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${statusEmoji} Test Run ${statusText}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Branch:*\n${runResult.git.branch}` },
        { type: 'mrkdwn', text: `*Commit:*\n\`${runResult.git.commit.slice(0, 7)}\`` },
        { type: 'mrkdwn', text: `*Total:*\n${runResult.totalTests}` },
        { type: 'mrkdwn', text: `*Duration:*\n${formatDuration(runResult.duration)}` },
        { type: 'mrkdwn', text: `*Passed:*\n${runResult.passedTests} :white_check_mark:` },
        { type: 'mrkdwn', text: `*Failed:*\n${runResult.failedTests} :x:` },
      ],
    },
  ];

  // Add flaky info if present
  if (runResult.flakyTests > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:warning: *${runResult.flakyTests} flaky test${runResult.flakyTests === 1 ? '' : 's'}* passed on retry`,
      },
    });
  }

  // Add failed test details (max 5 to keep message compact)
  const failed = runResult.tests.filter(
    (t: TestResult) => t.status === 'failed' || t.status === 'timedOut',
  );
  if (failed.length > 0) {
    const failedLines = failed.slice(0, 5).map((t: TestResult) => {
      const errorMsg = t.errors[0]?.message ?? 'Unknown error';
      const truncated = errorMsg.length > 60 ? errorMsg.slice(0, 57) + '...' : errorMsg;
      return `• \`${t.file} > ${t.title}\` — ${truncated}`;
    });

    if (failed.length > 5) {
      failedLines.push(`_...and ${failed.length - 5} more_`);
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Failed Tests:*\n${failedLines.join('\n')}`,
      },
    });
  }

  // Add report link if available
  if (reportUrl) {
    blocks.push({
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `<${reportUrl}|:bar_chart: View Full Report>` },
      ],
    });
  }

  // Footer
  blocks.push({
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: `_sorry-currents_ | ${runResult.git.author} | ${runResult.git.commitMessage}` },
    ],
  });

  return {
    text: fallbackText,
    blocks,
  };
}
