# @sorry-currents/core

Shared foundation package for sorry-currents. Provides Zod schemas, TypeScript types, pure utility functions, the Result pattern, error handling primitives, and notification payload builders.

**Zero Playwright dependency.** This package is imported by all other sorry-currents packages.

## Installation

```bash
npm install @sorry-currents/core
```

## API Overview

### Schemas & Types

All data models are defined as Zod schemas with TypeScript types derived via `z.infer`. The schema is the single source of truth.

| Schema | Type | Description |
|--------|------|-------------|
| `TestResultSchema` | `TestResult` | A single test execution result |
| `RunResultSchema` | `RunResult` | A complete test run (possibly merged from shards) |
| `ShardTimingDataSchema` | `ShardTimingData` | Per-test timing data for the shard balancer |
| `ShardPlanSchema` | `ShardPlan` | Output of the shard balancer — test-to-shard assignments |
| `TestHistorySchema` | `TestHistory` | Historical aggregation for a specific test |
| `InitConfigSchema` | `InitConfig` | Input to CI workflow generators |
| `GeneratedFileSchema` | `GeneratedFile` | Output of CI workflow generators |
| `ReporterOptionsSchema` | `ReporterOptions` | Configuration for the Playwright reporter |
| `TestErrorSchema` | `TestError` | Captured test error with optional stack and location |
| `AttachmentSchema` | `Attachment` | Reference to a test artifact (screenshot, video, trace) |

### Result Pattern

```typescript
import { type Result, ok, err } from '@sorry-currents/core';

// All I/O operations return Result<T, AppError> — never throw for expected failures
const result: Result<ShardTimingData[]> = await readTimingData(path);
if (!result.ok) {
  console.error(result.error.message);
}
```

### Error Handling

```typescript
import { AppError, ErrorCode } from '@sorry-currents/core';

// Structured errors with typed codes and context
const error = new AppError(
  ErrorCode.FILE_NOT_FOUND,
  'Timing data file not found',
  { path: '.sorry-currents/timing-data.json' },
);
```

### Utilities

| Function | Description |
|----------|-------------|
| `generateTestId(file, title, project)` | Deterministic test ID, stable across runs |
| `normalizeError(message)` | Strip variable parts for error grouping |
| `detectFlaky(testResult)` | Returns `true` if test passed on retry |
| `mergeRunResults(results)` | Combine shard results into a single run |
| `detectCI()` | Auto-detect CI provider from environment |
| `formatDuration(ms)` | Human-readable duration (e.g., `"2m 15s"`) |
| `computeStdDev(durations)` | Population standard deviation of durations |
| `readTimingData(path)` | Read and validate timing data JSON |
| `writeTimingData(path, data)` | Write versioned timing data JSON |
| `updateTimingData(existing, results)` | Merge new results into timing data |
| `readHistory(path)` | Read test history JSON |
| `writeHistory(path, data)` | Write versioned history JSON |
| `updateHistory(existing, results)` | Update history with new run results |
| `clusterErrors(results)` | Group failures by normalized error message |

### Notification Payload Builders

Pure functions that build notification payloads — no I/O, no network calls.

| Function | Output |
|----------|--------|
| `buildGitHubCommentBody(payload)` | Markdown string for PR comments |
| `buildGitHubStatusPayload(options)` | GitHub commit status API payload |
| `buildSlackPayload(options)` | Slack Block Kit message payload |
| `buildWebhookPayload(runResult)` | Generic webhook JSON payload |

## Architecture

```
core/src/
├── schemas/        # Zod schemas + z.infer types (single source of truth)
├── errors/         # ErrorCode enum, AppError class
├── utils/          # Pure functions (no I/O side effects)
├── notifications/  # Payload builders for integrations
├── result.ts       # Result<T, E> discriminated union
├── logger.ts       # Logger interface + ConsoleLogger
└── index.ts        # Barrel export (public API)
```

## Dependency Direction

`core` is the foundation — it imports nothing from other sorry-currents packages.

```
core ← reporter
core ← cli
core ← shard-balancer
core ← html-report
```
