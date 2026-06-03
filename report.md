# External URL Disclosure Report: @sorry-currents/cli

## Summary

This package is offline by default. It performs external HTTP calls only when the user explicitly invokes `sorry-currents notify` with integration flags.

## Runtime Endpoints

| Service         | URL Pattern                                                           | Trigger                        |
| --------------- | --------------------------------------------------------------------- | ------------------------------ |
| GitHub API      | `https://api.github.com/repos/{owner}/{repo}/issues/{issue}/comments` | `notify --github-comment`      |
| GitHub API      | `https://api.github.com/repos/{owner}/{repo}/statuses/{sha}`          | `notify --github-status`       |
| Slack           | User-provided webhook URL                                             | `notify --slack <webhook-url>` |
| Generic webhook | User-provided URL                                                     | `notify --webhook <url>`       |
| Datadog         | `https://api.{DD_SITE}/api/v1/series` (default `datadoghq.com`)       | `notify --datadog`             |

## URL Fragments Flagged by Scanner

1. `https://github.com/shand-j/sorry-currents` in generated markdown/report footers.
2. `datadoghq.com` as default site for optional Datadog metrics endpoint resolution.

## Trigger Conditions

1. Network calls only occur in `notify` command.
2. No background telemetry, no automatic data egress.
3. Integration credentials are required via environment variables:
   - `GITHUB_TOKEN` for GitHub calls
   - `DD_API_KEY` for Datadog

## Data Sent

1. Aggregated run metrics and test metadata (status, counts, duration, branch, commit).
2. No source code files are uploaded by default.
3. Optional URLs (report URL/webhook URL) are user-provided.

## Security Controls

1. HTTPS-only endpoints.
2. 30-second request timeouts.
3. Integration failures are non-fatal and logged as warnings.
4. Credentials are read from environment variables and not embedded in package source.

## Remediation Applied

1. Canonical repository footer links corrected to `https://github.com/shand-j/sorry-currents`.
2. This disclosure report added to document expected runtime URL behavior.
