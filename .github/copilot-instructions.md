# GitHub Copilot Instructions — sorry-currents

## Project Overview

sorry-currents is a CLI-native, zero-infrastructure, open-source Playwright test orchestration tool. It replaces the paid SaaS tool Currents.dev with a free alternative that plugs into Playwright's Custom Reporter API, persists data via CI artifacts, and provides smart shard balancing, enhanced reporting, and flaky test detection.

**Monorepo structure (pnpm workspaces):**
- `packages/core` — Shared types, schemas, utilities. Zero Playwright dependency.
- `packages/reporter` — Custom Playwright Reporter implementing the `Reporter` interface.
- `packages/cli` — The `sorry-currents` CLI binary. Entry point for all user commands.
- `packages/shard-balancer` — Smart test distribution engine (LPT algorithm).
- `packages/html-report` — Static HTML report generator.

**Tech stack:** Node.js 20+, TypeScript 5+ (strict mode), ESM-only (`"type": "module"`), tsup (build), pnpm, Vitest, Playwright.

---

## TypeScript Rules

- **Strict mode is mandatory.** `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitReturns: true` in tsconfig.
- **Never use `any`.** Use `unknown` and narrow with type guards or Zod parsing.
- **Explicit return types** on all public/exported functions. Inferred types are fine for private/internal functions.
- **Named exports only.** No default exports except where required by Playwright's reporter API (`export default MyReporter`).
- **Prefer `readonly` properties** and `as const` assertions. Immutability by default.
- **No enums in data models.** Use string literal union types for serializable data. `enum` is acceptable for internal-only code like `ErrorCode` and `LogLevel`.
- **Use `interface` for object shapes, `type` for unions and intersections.**

```typescript
// ✅ Good
interface TestResult {
  readonly id: string;
  readonly status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
}

// ❌ Bad
type TestResult = {
  id: any;
  status: string;
}
```

---

## Architecture & Patterns

### Dependency Direction

```
core ← reporter
core ← cli
core ← shard-balancer
core ← html-report
```

Core has zero imports from other packages. No package may import from `cli`. No circular dependencies.

### Result Pattern — No Thrown Errors

All operations that can fail in expected ways return `Result<T, AppError>`. Never throw for business logic. Exceptions are for truly unrecoverable situations only.

```typescript
type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// ✅ Good
async function readTimingData(path: string): Promise<Result<ShardTimingData[]>> {
  // Returns { ok: false, error } on missing file, parse error
}

// ❌ Bad
async function readTimingData(path: string): Promise<ShardTimingData[]> {
  // Throws on error — caller must try/catch
}
```

### Functional Core, Imperative Shell

- **Pure functions** for all computation: shard balancing, error normalization, ID generation, data merging, schema validation. No I/O side effects.
- **I/O at the edges:** file reads/writes, network calls, process spawning happen only in boundary code (CLI command handlers, reporter lifecycle hooks).

### Design Patterns in Use

| Pattern | Where | Why |
|---------|-------|-----|
| **Strategy** | Shard balancer algorithms | Swappable `ShardStrategy` implementations (LPT, RoundRobin, FileGroup) |
| **Builder** | Report construction, notification payloads | Complex object assembly in steps |
| **Template Method** | CI workflow generators | Common skeleton, provider-specific rendering (GitHub Actions, GitLab CI) |
| **Observer/EventEmitter** | Reporter lifecycle | Decouple data collection from processing |
| **Adapter** | Playwright version compat | Normalize Playwright API differences across versions |

### Classes vs Functions

- **Default to functions + interfaces.** No classes unless the pattern demands it.
- **Classes are acceptable for:** Strategy implementations, Builder, Template Method base classes, the Playwright Reporter (required by API), AppError.
- **No deep inheritance hierarchies.** Max one level of inheritance.

---

## Error Handling

### AppError Structure

All errors use the `AppError` class with a typed `ErrorCode`, human-readable `message`, structured `context`, and optional `cause` for error chaining.

```typescript
class AppError {
  constructor(
    readonly code: ErrorCode,
    readonly message: string,
    readonly context?: Record<string, unknown>,
    readonly cause?: Error,
  ) {}
}
```

### Error Rules

1. **Reporter errors must NEVER crash test execution.** Swallow, log a warning, continue.
2. **CLI commands** surface errors as human-readable messages with actionable hints. Exit codes: 0=success, 1=test failures, 2=sorry-currents error.
3. **Integration errors (GitHub, Slack)** are always non-fatal. Log the failure, exit 0.
4. **Validation errors** include the path to invalid data and expected vs actual values.
5. **Error context is structured** (key-value pairs), never string interpolation.

```typescript
// ✅ Good
logger.warn('Failed to write test result', { testId: test.id, path, error: err.code });

// ❌ Bad
logger.warn(`Failed to write test result ${test.id} to ${path}: ${err.message}`);
```

---

## Data Validation

### Zod at Trust Boundaries

All data from file I/O, CLI input, Playwright API, and environment variables **must** be validated with Zod schemas at the point of entry. Internal function-to-function data does NOT need runtime validation.

```typescript
// Types are DERIVED from Zod schemas — single source of truth
export const TestResultSchema = z.object({ ... });
export type TestResult = z.infer<typeof TestResultSchema>;
```

### Schema Versioning

All persisted JSON files include a `version` number and `generatedBy` field. When schemas change, write migration functions. Never silently drop data.

### Serialization

- JSON with 2-space indentation + trailing newline
- Dates as ISO 8601 UTC strings (never `Date` objects, never Unix timestamps)
- File paths relative to project root (never absolute)
- Binary data referenced by path (never base64 in JSON)

---

## Logging

- **Default:** `INFO` locally, `WARN` in CI (auto-detected).
- **Flags:** `--verbose` → `DEBUG`, `--quiet` → `ERROR`, `--silent` → `SILENT`.
- **All log output to stderr.** Stdout is reserved for machine-readable output (`--format json`, `--output-matrix`).
- **Structured context:** `logger.info('Plan generated', { shards: 4, tests: 487 })`.
- **Logger is injected via constructor**, never a global singleton. Test-friendly.
- **No logging dependencies.** Built-in console-based implementation.

---

## File & Code Conventions

- **File naming:** `kebab-case.ts` (e.g., `shard-balancer.ts`, `error-normalizer.ts`)
- **One primary export per file.** File named after what it exports.
- **Barrel exports** via `index.ts` per package. Only the public API is re-exported.
- **Comments explain WHY, never WHAT.** Code should be self-documenting.
- **No magic numbers.** Extract named constants.

---

## Dependencies

### Allowed Production Dependencies

- `zod` — schema validation
- `commander` — CLI parsing
- `chalk` — terminal colors
- `ora` — spinners
- `cli-table3` — table output
- `@octokit/rest` — GitHub API (integration commands only)
- `js-yaml` — CI workflow YAML generation

### Banned

- Anything requiring node-gyp or native compilation
- Logging frameworks (winston, pino, bunyan)
- HTTP server frameworks (Express, Fastify)
- ORMs or database drivers
- `lodash` (use native equivalents)
- `moment` / `dayjs` (use native `Date` + `Intl`)

### Playwright

Playwright is a **peer dependency**. Users bring their own version. Minimum supported: 1.30+. Import Playwright types from `@playwright/test/reporter`, never bundle Playwright code.

### Allowed Dev Dependencies

- `typescript` — compiler
- `vitest` — unit/integration testing
- `fast-check` — property-based testing
- `@playwright/test` — E2E testing
- `tsup` — ESM package bundling (esbuild-based)
- `eslint` — linting
- `prettier` — formatting

---

## Testing

### Framework & Tools

- **Vitest** for unit and integration tests
- **fast-check** for property-based testing (shard balancer)
- **Playwright** for E2E tests of the HTML report
- Test fixtures in `__fixtures__/` directories within each package

### Test Naming

```typescript
describe('<UnitUnderTest>', () => {
  describe('<method or scenario>', () => {
    it('should <expected behavior> when <condition>', () => { ... });
  });
});
```

### Coverage Targets

- `core`: ≥95% branch coverage
- `shard-balancer`: ≥90% branch coverage + property-based tests
- `reporter`: ≥80% branch coverage
- `cli`: ≥80% branch coverage
- `html-report`: visual regression tests prioritized over line coverage

### What to Test

- **Every pure function** has exhaustive unit tests covering happy path, edge cases, and error paths.
- **Edge cases are first-class:** empty arrays, single items, maximum sizes (1000+ tests), zero-value durations, unicode/special characters in test titles, missing optional fields.
- **Integration tests** spawn real Playwright processes and verify output file correctness.
- **Generated YAML** is parsed and structure-asserted (never just string-matched).
- **Fixtures** are committed and versioned: valid data, malformed data, edge-case data, cross-version data.

---

## CLI Behavior

- `sorry-currents init` auto-detects CI provider, package manager, Playwright config, and generates working CI workflow + reporter config.
- All commands work offline except `notify` (GitHub, Slack, webhooks).
- `--format json` outputs machine-readable JSON to stdout for piping.
- Exit codes: `0` success, `1` test failures detected, `2` sorry-currents operational error.
- Progress indicators (spinners, bars) auto-disable when not in a TTY.

---

## Git & PR Conventions

- Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`
- Branch naming: `feat/smart-sharding`, `fix/reporter-crash-resilience`
- PRs must include tests for new functionality and pass all CI checks
- Breaking changes require a `BREAKING CHANGE:` footer in the commit message

---

## Reminders

- This is a **zero-infrastructure tool**. Never introduce servers, databases, Docker requirements, or mandatory cloud services.
- The **reporter must never slow down or crash test execution**. It is a passive observer.
- **Playwright is the user's dependency**, not ours. Always handle missing/wrong Playwright versions gracefully.
- **CI artifacts are the persistence layer.** Design all data access patterns around file-based read/write, not network requests or databases.
- When in doubt, refer to `MASTER_PROMPT.md` at the repository root for the full specification.
