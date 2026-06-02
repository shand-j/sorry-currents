import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { Command } from 'commander';

import {
  ConsoleLogger,
  LogLevel,
  RunResultSchema,
  AppError,
  formatDuration,
  buildGitHubCommentBody,
  getCommentMarker,
  buildGitHubStatusPayload,
  buildSlackPayload,
  buildWebhookPayload,
  type RunResult,
  type Logger,
  type GitHubCommentPayload,
  type GitHubStatusPayload,
  type SlackPayload,
  type WebhookPayload,
} from '@sorry-currents/core';

interface NotifyOptions {
  readonly githubComment?: boolean;
  readonly githubStatus?: boolean;
  readonly slack?: string;
  readonly webhook?: string;
  readonly datadog?: boolean;
  readonly input?: string;
  readonly reportUrl?: string;
  readonly format?: string;
  readonly verbose?: boolean;
}

interface DatadogSeriesPayload {
  readonly series: readonly {
    readonly metric: string;
    readonly points: readonly [number, number][];
    readonly type: 'gauge' | 'count';
    readonly tags?: readonly string[];
  }[];
}

/**
 * Resolve GitHub owner/repo from GITHUB_REPOSITORY env var.
 * Returns undefined if not available.
 */
function resolveGitHubRepo(): { readonly owner: string; readonly repo: string } | undefined {
  const ghRepo = process.env['GITHUB_REPOSITORY'];
  if (!ghRepo) return undefined;
  const parts = ghRepo.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return undefined;
  return { owner: parts[0], repo: parts[1] };
}

/**
 * Resolve PR number from GITHUB_EVENT_PATH env var.
 * Falls back to RunResult git.pr.number.
 */
async function resolvePrNumber(runResult: RunResult, logger: Logger): Promise<number | undefined> {
  // First check RunResult data
  if (runResult.git.pr?.number) {
    return runResult.git.pr.number;
  }

  // Try GITHUB_EVENT_PATH
  const eventPath = process.env['GITHUB_EVENT_PATH'];
  if (!eventPath || !existsSync(eventPath)) {
    return undefined;
  }

  try {
    const stats = await import('node:fs/promises').then((m) => m.stat(eventPath));
    const MAX_EVENT_SIZE = 10 * 1024 * 1024; // 10 MB
    if (stats.size > MAX_EVENT_SIZE) {
      logger.warn('GitHub event file too large; skipping PR number resolution', {
        size: stats.size,
      });
      return undefined;
    }
    const raw = await readFile(eventPath, 'utf-8');
    const event = JSON.parse(raw) as Record<string, unknown>;
    const pr = event['pull_request'] as Record<string, unknown> | undefined;
    if (pr && typeof pr['number'] === 'number') {
      return pr['number'];
    }
    // Also check for issue_comment events
    const issue = event['issue'] as Record<string, unknown> | undefined;
    if (issue && typeof issue['number'] === 'number') {
      return issue['number'];
    }
  } catch (error) {
    logger.debug('Failed to parse GitHub event file', {
      path: eventPath,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return undefined;
}

/**
 * Send a GitHub PR comment using @octokit/rest.
 * Updates existing sorry-currents comment if found, otherwise creates a new one.
 */
async function sendGitHubComment(payload: GitHubCommentPayload, logger: Logger): Promise<void> {
  const token = process.env['GITHUB_TOKEN'];
  if (!token) {
    throw AppError.githubApiError(
      'GITHUB_TOKEN environment variable is required for --github-comment',
      { hint: 'Set GITHUB_TOKEN in your CI workflow or environment' },
    );
  }

  // Dynamic import — @octokit/rest is only needed when this flag is used
  const { Octokit } = await import('@octokit/rest');
  const octokit = new Octokit({ auth: token });

  const marker = getCommentMarker();

  // Look for an existing sorry-currents comment to update
  // Paginate through all comments to find existing sorry-currents comment
  const allComments: Array<{ id: number; body?: string | null }> = [];
  let page = 1;
  const perPage = 100;
  while (true) {
    const { data: comments } = await octokit.issues.listComments({
      owner: payload.owner,
      repo: payload.repo,
      issue_number: payload.issueNumber,
      per_page: perPage,
      page,
    });
    allComments.push(...comments);
    if (comments.length < perPage) break;
    page++;
  }

  const existing = allComments.find((c: { id: number; body?: string | null }) =>
    c.body?.includes(marker),
  );

  if (existing) {
    await octokit.issues.updateComment({
      owner: payload.owner,
      repo: payload.repo,
      comment_id: existing.id,
      body: payload.body,
    });
    logger.info('Updated existing PR comment', {
      pr: payload.issueNumber,
      commentId: existing.id,
    });
  } else {
    const { data: created } = await octokit.issues.createComment({
      owner: payload.owner,
      repo: payload.repo,
      issue_number: payload.issueNumber,
      body: payload.body,
    });
    logger.info('Created PR comment', {
      pr: payload.issueNumber,
      commentId: created.id,
    });
  }
}

/**
 * Set a GitHub commit status check using @octokit/rest.
 */
async function sendGitHubStatus(payload: GitHubStatusPayload, logger: Logger): Promise<void> {
  const token = process.env['GITHUB_TOKEN'];
  if (!token) {
    throw AppError.githubApiError(
      'GITHUB_TOKEN environment variable is required for --github-status',
      { hint: 'Set GITHUB_TOKEN in your CI workflow or environment' },
    );
  }

  const { Octokit } = await import('@octokit/rest');
  const octokit = new Octokit({ auth: token });

  await octokit.repos.createCommitStatus({
    owner: payload.owner,
    repo: payload.repo,
    sha: payload.sha,
    state: payload.state,
    description: payload.description,
    context: payload.context,
    ...(payload.targetUrl ? { target_url: payload.targetUrl } : {}),
  });

  logger.info('Set commit status', {
    sha: payload.sha.slice(0, 7),
    state: payload.state,
    description: payload.description,
  });
}

/**
 * Post a Slack notification via webhook URL using native fetch.
 */
async function sendSlackWebhook(
  webhookUrl: string,
  payload: SlackPayload,
  logger: Logger,
): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => 'unknown');
    throw AppError.slackWebhookError(`Slack webhook returned ${response.status}: ${body}`, {
      url: webhookUrl,
      status: response.status,
    });
  }

  logger.info('Slack notification sent');
}

/**
 * POST run results to a generic webhook endpoint using native fetch.
 */
async function sendWebhook(url: string, payload: WebhookPayload, logger: Logger): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'sorry-currents/0.5.0',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => 'unknown');
    throw AppError.webhookError(url, new Error(`HTTP ${response.status}: ${body}`));
  }

  logger.info('Webhook notification sent', { url, status: response.status });
}

function buildDatadogPayload(runResult: RunResult, tags: readonly string[]): DatadogSeriesPayload {
  const timestamp = Math.floor(Date.now() / 1000);
  const statusValue = runResult.status === 'passed' ? 1 : 0;

  return {
    series: [
      {
        metric: 'sorry_currents.run.duration_ms',
        points: [[timestamp, runResult.duration]],
        type: 'gauge',
        tags,
      },
      {
        metric: 'sorry_currents.run.total_tests',
        points: [[timestamp, runResult.totalTests]],
        type: 'gauge',
        tags,
      },
      {
        metric: 'sorry_currents.run.failed_tests',
        points: [[timestamp, runResult.failedTests]],
        type: 'gauge',
        tags,
      },
      {
        metric: 'sorry_currents.run.flaky_tests',
        points: [[timestamp, runResult.flakyTests]],
        type: 'gauge',
        tags,
      },
      {
        metric: 'sorry_currents.run.status',
        points: [[timestamp, statusValue]],
        type: 'gauge',
        tags,
      },
    ],
  };
}

async function sendDatadogMetrics(runResult: RunResult, logger: Logger): Promise<void> {
  const apiKey = process.env['DD_API_KEY'];
  if (!apiKey) {
    throw AppError.invalidConfig('DD_API_KEY environment variable is required for --datadog', {
      hint: 'Set DD_API_KEY in your CI or local environment',
    });
  }

  const site = process.env['DD_SITE'] ?? 'datadoghq.com';
  const endpoint = `https://api.${site}/api/v1/series`;

  const baseTags = [
    `status:${runResult.status}`,
    `branch:${runResult.git.branch || 'unknown'}`,
    `ci:${runResult.environment.ci || 'local'}`,
  ];
  const extraTags = (process.env['DD_TAGS'] ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const tags = [...baseTags, ...extraTags];

  const payload = buildDatadogPayload(runResult, tags);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DD-API-KEY': apiKey,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => 'unknown');
    throw AppError.networkError(endpoint, new Error(`HTTP ${response.status}: ${body}`));
  }

  logger.info('Datadog metrics sent', { site, series: payload.series.length });
}

export function registerNotifyCommand(program: Command): void {
  program
    .command('notify')
    .description('Send run results to integrations (GitHub, Slack, webhooks)')
    .option('--github-comment', 'Post test results as a PR comment (requires GITHUB_TOKEN)')
    .option('--github-status', 'Set commit status check (requires GITHUB_TOKEN)')
    .option('--slack <webhook-url>', 'Post summary to Slack webhook')
    .option('--webhook <url>', 'POST results to arbitrary HTTP endpoint')
    .option('--datadog', 'Send run summary metrics to Datadog (requires DD_API_KEY)')
    .option('--input <dir>', 'Results directory', '.sorry-currents')
    .option('--report-url <url>', 'URL to the full HTML report artifact')
    .option('--format <type>', 'Output format: text | json', 'text')
    .option('--verbose', 'Enable debug logging')
    .action(async (options: NotifyOptions) => {
      const logger = new ConsoleLogger(options.verbose ? LogLevel.DEBUG : LogLevel.INFO);

      const hasAnyTarget =
        options.githubComment ||
        options.githubStatus ||
        options.slack ||
        options.webhook ||
        options.datadog;
      if (!hasAnyTarget) {
        logger.error(
          'No notification target specified. Use --github-comment, --github-status, --slack, --webhook, or --datadog.',
        );
        process.exit(2);
        return;
      }

      // Load merged run result
      const inputDir = resolve(options.input ?? '.sorry-currents');
      const mergedPath = join(inputDir, 'merged-run-result.json');
      if (!existsSync(mergedPath)) {
        logger.error('No merged run result found. Run "sorry-currents merge" first.', {
          expected: mergedPath,
        });
        process.exit(2);
        return;
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

      // Track results for JSON output mode
      const results: Record<string, { readonly sent: boolean; readonly error?: string }> = {};

      // --- GitHub PR Comment ---
      if (options.githubComment) {
        try {
          const ghRepo = resolveGitHubRepo();
          if (!ghRepo) {
            throw AppError.githubApiError(
              'Cannot determine repository. Set GITHUB_REPOSITORY environment variable.',
              { hint: 'Format: owner/repo (automatically set in GitHub Actions)' },
            );
          }

          const prNumber = await resolvePrNumber(runResult, logger);
          if (!prNumber) {
            throw AppError.githubApiError(
              'Cannot determine PR number. This command requires a pull_request event.',
              { hint: 'Ensure this runs on pull_request events or set git.pr in run result' },
            );
          }

          const payload = buildGitHubCommentBody({
            runResult,
            owner: ghRepo.owner,
            repo: ghRepo.repo,
            prNumber,
            reportUrl: options.reportUrl,
          });

          if (options.format === 'json') {
            process.stdout.write(
              JSON.stringify({ target: 'github-comment', payload }, null, 2) + '\n',
            );
          } else {
            await sendGitHubComment(payload, logger);
          }
          results['github-comment'] = { sent: true };
        } catch (error) {
          const msg = error instanceof AppError ? error.message : String(error);
          logger.warn('GitHub PR comment failed (non-fatal)', { error: msg });
          results['github-comment'] = { sent: false, error: msg };
        }
      }

      // --- GitHub Commit Status ---
      if (options.githubStatus) {
        try {
          const ghRepo = resolveGitHubRepo();
          if (!ghRepo) {
            throw AppError.githubApiError(
              'Cannot determine repository. Set GITHUB_REPOSITORY environment variable.',
            );
          }

          const payload = buildGitHubStatusPayload({
            runResult,
            owner: ghRepo.owner,
            repo: ghRepo.repo,
            reportUrl: options.reportUrl,
          });

          if (options.format === 'json') {
            process.stdout.write(
              JSON.stringify({ target: 'github-status', payload }, null, 2) + '\n',
            );
          } else {
            await sendGitHubStatus(payload, logger);
          }
          results['github-status'] = { sent: true };
        } catch (error) {
          const msg = error instanceof AppError ? error.message : String(error);
          logger.warn('GitHub status check failed (non-fatal)', { error: msg });
          results['github-status'] = { sent: false, error: msg };
        }
      }

      // --- Slack Webhook ---
      if (options.slack) {
        try {
          const payload = buildSlackPayload({
            runResult,
            reportUrl: options.reportUrl,
          });

          if (options.format === 'json') {
            process.stdout.write(JSON.stringify({ target: 'slack', payload }, null, 2) + '\n');
          } else {
            await sendSlackWebhook(options.slack, payload, logger);
          }
          results['slack'] = { sent: true };
        } catch (error) {
          const msg = error instanceof AppError ? error.message : String(error);
          logger.warn('Slack notification failed (non-fatal)', { error: msg });
          results['slack'] = { sent: false, error: msg };
        }
      }

      // --- Generic Webhook ---
      if (options.webhook) {
        try {
          const payload = buildWebhookPayload(runResult);

          if (options.format === 'json') {
            process.stdout.write(JSON.stringify({ target: 'webhook', payload }, null, 2) + '\n');
          } else {
            await sendWebhook(options.webhook, payload, logger);
          }
          results['webhook'] = { sent: true };
        } catch (error) {
          const msg = error instanceof AppError ? error.message : String(error);
          logger.warn('Webhook notification failed (non-fatal)', { error: msg });
          results['webhook'] = { sent: false, error: msg };
        }
      }

      // --- Datadog Metrics ---
      if (options.datadog) {
        try {
          if (options.format === 'json') {
            process.stdout.write(
              JSON.stringify(
                {
                  target: 'datadog',
                  payload: buildDatadogPayload(runResult, [
                    `status:${runResult.status}`,
                    `branch:${runResult.git.branch || 'unknown'}`,
                    `ci:${runResult.environment.ci || 'local'}`,
                  ]),
                },
                null,
                2,
              ) + '\n',
            );
          } else {
            await sendDatadogMetrics(runResult, logger);
          }

          results['datadog'] = { sent: true };
        } catch (error) {
          const msg = error instanceof AppError ? error.message : String(error);
          logger.warn('Datadog notification failed (non-fatal)', { error: msg });
          results['datadog'] = { sent: false, error: msg };
        }
      }

      // Summary
      const sentCount = Object.values(results).filter((r) => r.sent).length;
      const failedCount = Object.values(results).filter((r) => !r.sent).length;
      logger.info('Notification summary', { sent: sentCount, failed: failedCount });

      if (options.format === 'json') {
        process.stdout.write(JSON.stringify({ summary: results }, null, 2) + '\n');
      }

      // Integration errors are always non-fatal — exit 0
    });
}
