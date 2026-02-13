# @sorry-currents/reporter

Custom Playwright Reporter that captures test execution data for sorry-currents.

Implements Playwright's `Reporter` interface. Writes structured JSON results that power smart shard balancing, enhanced reporting, and flaky test detection.

## Installation

```bash
npm install --save-dev @sorry-currents/reporter
```

## Usage

Add to your `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['list'],
    ['@sorry-currents/reporter', {
      outputDir: '.sorry-currents',
      attachArtifacts: true,
    }],
  ],
});
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `outputDir` | `string` | `'.sorry-currents'` | Directory for result files |
| `runId` | `string` | auto-detect | Explicit run ID (falls back to CI env vars) |
| `attachArtifacts` | `boolean` | `true` | Copy screenshots/videos/traces |
| `artifactsDir` | `string` | `'test-results'` | Playwright's artifact output dir |
| `silent` | `boolean` | `false` | Suppress reporter console output |

## Output Structure

```
.sorry-currents/
├── runs/
│   └── <run-id>/
│       ├── run-result.json       # Complete RunResult
│       ├── shard-1-of-4.json     # Per-shard result (when sharded)
│       └── tests/
│           ├── <test-id>.json    # Individual test results
│           └── ...
├── history.json                  # Test history (updated after each run)
└── timing-data.json              # Timing data for shard balancer
```

## Key Behaviors

- **Crash-resilient:** Each test result is written immediately in `onTestEnd`, not buffered until the end. If CI crashes mid-run, partial results are preserved.
- **Shard-aware:** Detects shard index from Playwright config. Writes shard-specific output files.
- **Non-blocking:** File writes are async — the reporter never slows down test execution.
- **Never crashes tests:** All reporter errors are caught and logged as warnings. The reporter is a passive observer.
- **Retry deduplication:** Only the final retry attempt per test is kept. Flaky tests (passed on retry) are correctly detected.

## Playwright Compatibility

Playwright is a **peer dependency**. Users bring their own version. Minimum supported: 1.30+.
