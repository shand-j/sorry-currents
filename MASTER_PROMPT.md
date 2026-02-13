# sorry-currents: Master Prompt for MVP Development

## Project Identity

**Name:** sorry-currents
**Tagline:** "Free, open-source Playwright test orchestration. No cloud required."
**License:** MIT
**Repository:** Monorepo (pnpm workspaces)
**Runtime:** Node.js 20+ / TypeScript 5+
**Module System:** ESM-only (`"type": "module"` in all package.json files)
**Build Tool:** tsup (esbuild-based, added to allowed dev-deps)
**Package Manager:** pnpm

---

## Context & Motivation

Currents.dev (born from the OSS project sorry-cypress) provides a SaaS dashboard for Playwright test orchestration, debugging, flaky test detection, and analytics. It charges $49/month base + $5 per additional 1,000 test results. Enterprise teams running 500+ tests across 20+ daily CI runs easily pay $200-2,000+/month.

sorry-currents delivers the same core value as a **CLI-native, zero-infrastructure OSS tool** that:
1. Plugs directly into Playwright via its Custom Reporter API
2. Persists historical data using CI artifacts (GitHub Actions artifacts, GitLab CI artifacts) — no external database or cloud service required
3. Uses historical timing data to intelligently balance test distribution across CI shards (the feature Currents charges most for)
4. Generates rich, static HTML reports with flaky test detection, historical comparison, and artifact surfacing

**Key differentiators from Currents.dev:**
- Zero cost, no test volume limits
- Zero infrastructure — no servers, no Docker, no database to maintain
- CLI-first UX designed for devs already in terminals
- CI-native — piggybacks on CI provider's artifact storage for persistence
- Fully open-source with MIT license

**Key differentiators from existing OSS tools (Allure, ReportPortal, Monocart):**
- Smart shard balancing using historical timing data (none of the OSS tools do this)
- Zero infrastructure (ReportPortal requires a full server stack; Allure needs allure-server for history)
- Designed specifically for Playwright (not a generic test reporter)
- Single `npm install` + config line to get started

---

## Architecture Overview

```
sorry-currents/
├── packages/
│   ├── reporter/          # Custom Playwright Reporter
│   ├── cli/               # CLI tool (sorry-currents command)
│   ├── core/              # Shared types, data models, utilities
│   ├── shard-balancer/    # Smart shard distribution engine
│   └── html-report/       # Static HTML report generator
├── .github/
│   └── workflows/         # Example CI workflows + dogfooding
├── docs/                  # Documentation site
├── examples/              # Example Playwright projects with sorry-currents
├── package.json           # Workspace root
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## Infrastructure Specification

These templates define the exact contents of workspace-level configuration files. They are the first files created during Phase 1 bootstrapping.

### pnpm-workspace.yaml

```yaml
packages:
  - 'packages/*'
```

### Root package.json

```jsonc
{
  "name": "sorry-currents",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20.0.0"
  },
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "build": "pnpm --filter './packages/*' run build",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "pnpm --filter './packages/*' run typecheck",
    "lint": "eslint 'packages/*/src/**/*.ts'",
    "clean": "pnpm --filter './packages/*' run clean"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "eslint": "^9.0.0",
    "prettier": "^3.0.0",
    "tsup": "^8.0.0",
    "fast-check": "^4.0.0"
  }
}
```

### tsconfig.base.json

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

### Per-package tsconfig.json (template)

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"]
}
```

### Per-package package.json (template — example for core)

```jsonc
{
  "name": "@sorry-currents/core",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "zod": "^3.24.0"
  }
}
```

### CLI package bin entry

```jsonc
// packages/cli/package.json (partial — unique fields)
{
  "name": "sorry-currents",
  "bin": {
    "sorry-currents": "./dist/index.js"
  },
  "dependencies": {
    "@sorry-currents/core": "workspace:*",
    "@sorry-currents/shard-balancer": "workspace:*",
    "@sorry-currents/html-report": "workspace:*",
    "commander": "^13.0.0",
    "chalk": "^5.4.0",
    "ora": "^8.0.0",
    "cli-table3": "^0.6.0",
    "js-yaml": "^4.1.0"
  }
}
```

### Reporter package entry point

```jsonc
// packages/reporter/package.json (partial — unique fields)
{
  "name": "@sorry-currents/reporter",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "dependencies": {
    "@sorry-currents/core": "workspace:*"
  },
  "peerDependencies": {
    "@playwright/test": ">=1.30.0"
  }
}
```

### vitest.config.ts (root — workspace mode)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    workspace: ['packages/*/vitest.config.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

### Per-package vitest.config.ts (template)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/__fixtures__/**'],
    },
  },
});
```

### .gitignore

```
node_modules/
dist/
.sorry-currents/
*.tsbuildinfo
coverage/
.DS_Store
```

### Phase 1 Bootstrapping Checklist

Create files in this exact order during Phase 1, step 1 ("Set up monorepo"):

```
 1. pnpm-workspace.yaml
 2. package.json (root)
 3. tsconfig.base.json
 4. .gitignore
 5. vitest.config.ts (root)
 6. packages/core/package.json
 7. packages/core/tsconfig.json
 8. packages/core/vitest.config.ts
 9. packages/core/src/result.ts          — Result<T, E> type
10. packages/core/src/logger.ts          — Logger interface + LogLevel enum
11. packages/core/src/errors/error-codes.ts
12. packages/core/src/errors/app-error.ts
13. packages/core/src/errors/index.ts
14. packages/core/src/schemas/           — All Zod schemas (one file per model)
15. packages/core/src/utils/             — Pure utility functions
16. packages/core/src/index.ts           — Barrel export
17. packages/reporter/package.json
18. packages/reporter/tsconfig.json
19. packages/reporter/vitest.config.ts
20. packages/reporter/src/index.ts       — SorryCurrentsReporter (default export)
21. packages/cli/package.json
22. packages/cli/tsconfig.json
23. packages/cli/vitest.config.ts
24. packages/cli/src/index.ts            — CLI entry point with shebang
25. packages/cli/src/commands/merge.ts
26. packages/cli/src/commands/init.ts
```

---

## Package Specifications

### 1. `@sorry-currents/core`

Shared foundation package. No Playwright dependency.

**Data Models (TypeScript interfaces):**

> **Note:** The interfaces below are *illustrative* — they show the shape of each data model. In actual code, types are derived from Zod schemas via `type X = z.infer<typeof XSchema>` (producing `type` aliases, not `interface` declarations). The Zod schema is the single source of truth.

```typescript
// A single test execution result
interface TestResult {
  id: string;                    // Deterministic hash of: file + title + project
  file: string;                  // Relative path to spec file
  title: string;                 // Full test title (including describe blocks)
  project: string;               // Playwright project name
  status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
  duration: number;              // milliseconds
  retries: number;               // Number of retry attempts
  isFlaky: boolean;              // passed on retry = flaky
  errors: TestError[];           // Captured errors
  annotations: Annotation[];    // Playwright annotations
  tags: string[];                // Playwright tags (@slow, @critical, etc.)
  attachments: Attachment[];     // References to screenshots, videos, traces
  startedAt: string;             // ISO timestamp
  workerId: number;              // Playwright worker ID
  shardIndex?: number;           // Which shard ran this test
}

// A complete test run
interface RunResult {
  id: string;                    // Unique run ID (CI build ID or UUID)
  timestamp: string;             // ISO timestamp
  duration: number;              // Total run duration ms
  status: 'passed' | 'failed' | 'timedOut' | 'interrupted';
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  flakyTests: number;
  shardCount: number;
  shardIndex?: number;           // If this is a shard result
  tests: TestResult[];
  environment: EnvironmentInfo;
  git: GitInfo;
  config: RunConfig;
}

interface EnvironmentInfo {
  os: string;
  nodeVersion: string;
  playwrightVersion: string;
  ci: string;                    // 'github-actions' | 'gitlab-ci' | 'jenkins' | 'local'
  runner?: string;               // Runner name/ID
}

interface GitInfo {
  branch: string;
  commit: string;
  commitMessage: string;
  author: string;
  remote?: string;
  pr?: {
    number: number;
    title: string;
    url: string;
  };
}

interface RunConfig {
  workers: number;
  projects: string[];
  retries: number;
  timeout: number;
}

interface TestError {
  message: string;
  stack?: string;
  snippet?: string;              // Source code snippet around the error
  location?: {
    file: string;
    line: number;
    column: number;
  };
}

interface Attachment {
  name: string;
  contentType: string;
  path: string;                  // Relative path to artifact file (always by reference, never inline)
}

interface Annotation {
  type: string;
  description?: string;
}

// Historical aggregation for a specific test
interface TestHistory {
  id: string;                    // Same deterministic test ID
  title: string;
  file: string;
  project: string;
  totalRuns: number;
  passCount: number;
  failCount: number;
  flakyCount: number;
  skipCount: number;
  avgDuration: number;           // milliseconds
  p95Duration: number;
  lastDurations: number[];       // Last N durations for trend analysis
  flakinessRate: number;         // 0-1 float
  failureRate: number;           // 0-1 float
  lastSeen: string;              // ISO timestamp
  topErrors: ErrorSummary[];     // Most common errors for this test
}

interface ErrorSummary {
  message: string;               // Error message (normalized)
  count: number;
  lastSeen: string;
  exampleStack?: string;
}

// Shard timing data for the balancer
interface ShardTimingData {
  testId: string;
  file: string;
  project: string;
  avgDuration: number;
  p95Duration: number;
  samples: number;               // How many data points
}

// Output of the shard balancer — assignment of tests to shards
interface ShardPlan {
  shards: ShardAssignment[];
  strategy: 'lpt' | 'round-robin' | 'file-group';
  totalTests: number;
  maxShardDuration: number;      // Estimated max shard wall time (ms)
  minShardDuration: number;      // Estimated min shard wall time (ms)
  improvement?: number;          // Estimated % improvement over naive split
  generatedAt: string;           // ISO timestamp
}

interface ShardAssignment {
  shardIndex: number;            // 1-based
  tests: string[];               // Test file paths or test IDs
  estimatedDuration: number;     // Estimated total duration for this shard (ms)
}

// Input to CI workflow generators (Template Method pattern)
interface InitConfig {
  ciProvider: 'github-actions' | 'gitlab-ci' | 'azure-pipelines';
  shardCount: number;
  packageManager: 'npm' | 'yarn' | 'pnpm';
  playwrightConfigPath: string;  // Relative path to playwright.config.ts
  installCommand: string;        // e.g., "pnpm install"
  browserInstallCommand: string; // e.g., "npx playwright install --with-deps"
  testCommand: string;           // e.g., "npx playwright test"
  branchFilters: string[];       // Branches that trigger CI (e.g., ['main', 'master'])
  includeSlack: boolean;
  slackWebhookUrl?: string;
  includeGitHubComment: boolean;
}

// Output of CI workflow generators
interface GeneratedFile {
  path: string;                  // Relative path where file should be written
  content: string;               // File content
  action: 'create' | 'modify';  // Whether this is a new file or modifying existing
  description: string;           // Human-readable description for CLI output
}

// Reporter constructor options (passed via playwright.config.ts)
interface ReporterOptions {
  outputDir: string;             // Where to write results (default: '.sorry-currents')
  runId?: string;                // Explicit run ID (default: auto-detect from CI env)
  attachArtifacts: boolean;      // Include screenshots/videos/traces (default: true)
  artifactsDir: string;          // Playwright's artifact output dir (default: 'test-results')
  silent: boolean;               // Suppress reporter console output (default: false)
}
```

**Utilities:**
- `generateTestId(file, title, project)` — deterministic, stable across runs
- `normalizeError(message)` — strip variable parts (timestamps, IDs) for error grouping
- `detectFlaky(testResult)` — returns true if test passed on retry
- `mergeRunResults(results: RunResult[])` — combine shard results into single run
- Git info extraction (via `git` CLI or env vars for CI)
- CI detection (auto-detect GitHub Actions, GitLab CI, Jenkins, CircleCI, etc.)

---

### 2. `@sorry-currents/reporter`

**Purpose:** Custom Playwright Reporter that captures test execution data.

**Installation & Usage:**

```bash
npm install --save-dev @sorry-currents/reporter
```

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['list'],  // Keep console output
    ['@sorry-currents/reporter', {
      outputDir: '.sorry-currents',     // Where to write results
      runId: process.env.CI_BUILD_ID,   // Optional: explicit run ID
      attachArtifacts: true,            // Include screenshots/videos/traces
      artifactsDir: 'test-results',     // Playwright's artifact output dir
    }],
  ],
});
```

**Implementation:**

Implement Playwright's `Reporter` interface:

```typescript
import type { Reporter, FullConfig, Suite, TestCase, TestResult, FullResult } from '@playwright/test/reporter';

class SorryCurrentsReporter implements Reporter {
  onBegin(config: FullConfig, suite: Suite): void {
    // Initialize run, capture config, count total tests
    // Create output directory
    // Detect CI environment, git info
  }

  onTestBegin(test: TestCase, result: TestResult): void {
    // Log test start (for real-time progress tracking if needed)
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    // Capture: status, duration, errors, retries, attachments
    // Write incremental results (crash-resilient: don't wait for onEnd)
    // Each test result written as individual JSON to outputDir
  }

  onEnd(result: FullResult): Promise<void> {
    // Aggregate all test results into a single RunResult JSON
    // Calculate summary stats (pass/fail/flaky counts)
    // Write final run-result.json
    // If shard: write shard-specific file (shard-1-of-4.json)
    // Print summary to console
  }
}
```

**Output Files Structure:**
```
.sorry-currents/
├── runs/
│   └── <run-id>/
│       ├── run-result.json           # Complete RunResult
│       ├── shard-1-of-4.json         # If sharded: per-shard result
│       ├── tests/
│       │   ├── <test-id-1>.json      # Individual test result (crash resilience)
│       │   └── <test-id-2>.json
│       └── artifacts/                # Copies/symlinks to screenshots, videos, traces
│           ├── <test-id-1>/
│           │   ├── screenshot.png
│           │   ├── video.webm
│           │   └── trace.zip
│           └── ...
├── history.json                      # Aggregated TestHistory[] (updated after each run)
└── timing-data.json                  # ShardTimingData[] for the balancer
```

**Key behavioral requirements:**
- **Crash-resilient:** Write each test result immediately in `onTestEnd`, not buffered until `onEnd`. If CI crashes mid-run, you still get partial results.
- **Shard-aware:** Detect shard index from Playwright config or `--shard` CLI arg. Write shard-specific output files.
- **Non-blocking:** Reporter must not measurably slow down test execution. File writes should be async with queuing.
- **Artifact handling:** Copy (or symlink) Playwright's test-results artifacts into the sorry-currents output directory with stable, predictable paths.

---

### 3. `@sorry-currents/shard-balancer`

**Purpose:** The killer feature. Analyze historical test timing data and generate optimal shard assignments that minimize total wall-clock time.

**The problem with Playwright's native sharding:**
Playwright's `--shard=x/y` distributes test FILES (or tests with `fullyParallel`) evenly by COUNT, not by DURATION. If you have 3 files taking [10min, 10min, 2min, 3min] across 2 shards, native sharding might put the two 10min files on the same shard (20min) while the other shard finishes in 5min. That's 15 minutes wasted.

**sorry-currents' approach:**
Use historical duration data to solve a bin-packing / load-balancing problem:
1. Read timing-data.json (average durations per test/file)
2. Apply a greedy "Longest Processing Time First" (LPT) algorithm to assign tests/files to shards such that total estimated time per shard is balanced
3. Output a shard assignment file that the CI workflow uses

**Algorithm:**

```
Input: 
  - tests[] with estimated durations (from history or defaults)
  - shardCount (number of parallel CI jobs)

Algorithm (LPT - Longest Processing Time First):
  1. Sort tests by estimated duration DESCENDING
  2. Initialize shardCount buckets with total_time = 0
  3. For each test:
     - Assign to the bucket with the LOWEST total_time
     - Add test duration to that bucket's total_time
  4. Output: mapping of test → shard index

Output:
  - shard-plan.json: { shardIndex: number, tests: string[], estimatedDuration: number }[]
  - Estimated improvement over naive sharding (%)
```

**CLI Integration:**

```bash
# Generate optimal shard plan based on historical timing data
sorry-currents plan --shards 4 --output shard-plan.json

# In CI, each shard reads its assignment and runs only those tests
sorry-currents run --shard-plan shard-plan.json --shard-index 1
# This internally calls: npx playwright test <list-of-files-for-this-shard>
```

**For teams without history (cold start):**
- First run: use naive sharding (pass through to Playwright native `--shard`)
- Capture timing data from this first run
- Second run onwards: use smart balancing
- CLI should print a message: "Cold start: using native sharding. Smart balancing will activate after first run."

**For CI (GitHub Actions example):**

```yaml
jobs:
  plan:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.plan.outputs.matrix }}
    steps:
      - uses: actions/checkout@v4
      - name: Download previous timing data
        uses: actions/download-artifact@v4
        with:
          name: sorry-currents-timing
          path: .sorry-currents/
        continue-on-error: true  # First run won't have data
      - name: Generate shard plan
        id: plan
        run: npx sorry-currents plan --shards 4 --output-matrix

  test:
    needs: plan
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix: ${{ fromJson(needs.plan.outputs.matrix) }}
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npx playwright install --with-deps
      - name: Run tests
        run: npx sorry-currents run --shard-plan shard-plan.json --shard-index ${{ matrix.shardIndex }}
      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: sorry-currents-results-${{ matrix.shardIndex }}
          path: .sorry-currents/

  report:
    needs: test
    if: always()
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Download all shard results
        uses: actions/download-artifact@v4
        with:
          pattern: sorry-currents-results-*
          path: .sorry-currents/shards/
          merge-multiple: true
      - name: Merge & generate report
        run: |
          npx sorry-currents merge
          npx sorry-currents report --format html
      - name: Upload timing data for next run
        uses: actions/upload-artifact@v4
        with:
          name: sorry-currents-timing
          path: .sorry-currents/timing-data.json
          retention-days: 90
      - name: Upload HTML report
        uses: actions/upload-artifact@v4
        with:
          name: sorry-currents-report
          path: .sorry-currents/report/
```

---

### 4. `@sorry-currents/cli`

**Purpose:** Unified CLI tool that orchestrates all functionality.

**Package name:** `sorry-currents` (the bin name)

**Commands:**

```
sorry-currents init [options]
  Interactive onboarding wizard. Detects project setup, configures the reporter,
  and generates CI workflow files with shard balancing and artifact persistence.
  This is the FIRST command a user runs — it must get them from zero to working
  CI pipeline in under 2 minutes.

  --ci <provider>        CI provider: 'github-actions' | 'gitlab-ci' | 'azure-pipelines'
                         (default: auto-detect from repo)
  --shards <n>           Number of parallel shards (default: 4)
  --package-manager <pm> 'npm' | 'yarn' | 'pnpm' (default: auto-detect)
  --playwright-config <p> Path to playwright config (default: auto-detect)
  --skip-prompts         Accept all defaults, no interactive prompts
  --dry-run              Print what would be generated without writing files

  Auto-detection logic:
    1. CI provider: check for .github/, .gitlab-ci.yml, azure-pipelines.yml
    2. Package manager: check for pnpm-lock.yaml, yarn.lock, package-lock.json
    3. Playwright config: search for playwright.config.{ts,js,mjs}
    4. Existing test command: parse scripts in package.json
    5. Install command: derive from package manager (npm ci, pnpm install, etc.)
    6. Browser install: detect if browsers are cached or need npx playwright install
    7. Existing CI workflow: detect and offer to modify vs. create new

  Interactive prompts (when not --skip-prompts):
    - "Detected GitHub Actions. Correct?" [Y/n]
    - "How many parallel shards?" [4]
    - "Include Slack notifications?" [y/N] → if yes, prompt for webhook URL
    - "Include GitHub PR comments?" [Y/n]
    - "Branch filter for CI trigger?" [main, master]

  Generated files (GitHub Actions example):
    .github/workflows/playwright.yml     — Full CI workflow with plan/test/report jobs
    playwright.config.ts                 — MODIFIED: adds sorry-currents reporter
    .gitignore                           — MODIFIED: adds .sorry-currents/

  Generated files (GitLab CI example):
    .gitlab-ci.yml                       — Pipeline with parallel keyword + artifacts
    playwright.config.ts                 — MODIFIED: adds sorry-currents reporter
    .gitignore                           — MODIFIED: adds .sorry-currents/

  Post-generation output:
    ✅ Created .github/workflows/playwright.yml
    ✅ Added sorry-currents reporter to playwright.config.ts
    ✅ Added .sorry-currents/ to .gitignore

    Next steps:
      1. Commit these changes and push
      2. Your first run will use native sharding (cold start)
      3. From the second run, smart shard balancing kicks in automatically

    Run locally to verify:  npx sorry-currents run
    Docs:                   https://github.com/sorry-currents/sorry-currents

sorry-currents plan [options]
  Generate an optimized shard execution plan.
  
  --shards <n>           Number of shards (required)
  --timing <path>        Path to timing data (default: .sorry-currents/timing-data.json)
  --output <path>        Write plan to file (default: stdout)
  --output-matrix        Output GitHub Actions matrix JSON to stdout
  --strategy <name>      Balancing strategy: 'lpt' | 'round-robin' | 'file' (default: lpt)
  --default-timeout <ms> Estimated duration for tests without history (default: 30000)

sorry-currents run [options]
  Run Playwright tests with sorry-currents reporter auto-configured.
  
  --shard-plan <path>    Use a generated shard plan
  --shard-index <n>      Which shard index to execute (1-based)
  --run-id <id>          Explicit run ID (default: auto-detect from CI)
  -- [playwright args]   Pass-through args to Playwright

sorry-currents merge [options]
  Merge results from multiple shards into a single run result.
  
  --input <dir>          Directory containing shard results (default: .sorry-currents/shards/)
  --output <dir>         Output directory (default: .sorry-currents/)

sorry-currents report [options]
  Generate reports from run results.
  
  --format <type>        Report format: 'html' | 'json' | 'markdown' (default: html)
  --input <dir>          Results directory (default: .sorry-currents/)
  --output <dir>         Report output directory (default: .sorry-currents/report/)
  --history              Include historical comparison (requires previous run data)
  --open                 Open HTML report in browser after generation

sorry-currents history [options]
  View test history and analytics from the terminal.
  
  --flaky                Show flakiest tests (sorted by flakiness rate)
  --slow                 Show slowest tests (sorted by p95 duration)
  --failing              Show most failing tests
  --limit <n>            Number of results to show (default: 20)
  --format <type>        Output format: 'table' | 'json' (default: table)

sorry-currents notify [options]
  Send run results to integrations.
  
  --slack <webhook-url>  Post summary to Slack
  --github-comment       Post PR comment (requires GITHUB_TOKEN)
  --github-status        Set commit status check (requires GITHUB_TOKEN)
  --webhook <url>        POST results to arbitrary HTTP endpoint
  --datadog              Send metrics to Datadog (requires DD_API_KEY)
```

**Technical implementation:**
- Use `commander` for CLI parsing
- Use `chalk` + `ora` for terminal UX (spinners, colors, tables)
- Use `cli-table3` for tabular output
- Auto-detect CI environment via env vars (GITHUB_ACTIONS, GITLAB_CI, JENKINS_URL, etc.)
- All commands should work both locally and in CI
- Exit codes: 0 = success, 1 = test failures found, 2 = sorry-currents error

---

### 5. `@sorry-currents/html-report`

**Purpose:** Generate a static HTML report that's richer than Playwright's built-in HTML reporter.

**Differentiators from Playwright's HTML report:**
1. **Flaky test highlighting** — flaky tests get a distinct visual treatment (amber/yellow), not just pass/fail
2. **Historical comparison** — "This test was 2x slower than its average" / "This test started failing 3 runs ago"
3. **Error clustering** — group failures by normalized error message, show count
4. **Shard distribution visualization** — show how tests were distributed and each shard's wall time
5. **Run-over-run trends** — mini charts showing duration/pass-rate trends for each test
6. **One-click artifact access** — screenshots, videos, traces embedded or linked directly

**Technical implementation:**
- Generate a single self-contained HTML file (inline CSS/JS)
- Use a lightweight framework: Preact or vanilla JS with a build step
- Data is embedded as `<script>const DATA = {...}</script>`
- Total bundle should be < 500KB including all assets
- Dark mode support
- Responsive (works on mobile for on-the-go debugging)
- Sortable/filterable tables
- Search across test names and error messages

---

## Integration Specifications

### GitHub Integration (MVP)

**PR Comments:**
```markdown
## sorry-currents Test Results

| Metric | Value |
|--------|-------|
| Total  | 487   |
| Passed | 479 ✅ |
| Failed | 3 ❌  |
| Flaky  | 5 ⚠️  |
| Duration | 4m 32s |

### ❌ Failed Tests
| Test | Error | Duration |
|------|-------|----------|
| `checkout.spec.ts > should apply discount` | Expected 19.99, got 20.00 | 12.3s |
| ... | ... | ... |

### ⚠️ Flaky Tests (passed on retry)
| Test | Flakiness Rate (30d) | Retries |
|------|---------------------|---------|
| `search.spec.ts > should autocomplete` | 23% | 2 |
| ... | ... | ... |

📊 [Full Report](link-to-artifact) | ⚡ Sharding saved ~35% CI time
```

**Commit Status Checks:**
- Set `pending` → `success`/`failure` status on the commit
- Include summary in the status description

**Implementation:**
- Use `@octokit/rest` for GitHub API calls
- Require `GITHUB_TOKEN` (available by default in GitHub Actions)
- Auto-detect PR number from `GITHUB_EVENT_PATH`

### Slack Integration (MVP)

- POST a formatted message to a Slack webhook URL
- Include: run status, pass/fail counts, flaky count, duration, link to report
- Use Slack Block Kit for rich formatting

---

## Development Phases

### Phase 1: Foundation (Weeks 1-3)
**Goal:** Reporter captures data, CLI merges shards, `init` gets users running in 2 minutes

1. Set up monorepo (pnpm workspaces, TypeScript, ESLint, Vitest for testing)
2. Implement `@sorry-currents/core` — all data models, utility functions
3. Implement `@sorry-currents/reporter` — Custom Playwright Reporter
   - Captures all test data in `onTestEnd`
   - Crash-resilient incremental writes
   - Shard-aware output
4. Implement `sorry-currents merge` command
5. Implement `sorry-currents init` command
   - Auto-detection (CI provider, package manager, Playwright config)
   - CI workflow template generation (GitHub Actions first, GitLab CI stub)
   - Playwright config modification (add reporter)
   - .gitignore modification
   - Interactive prompts with sensible defaults
6. Write tests using a real Playwright project (dogfood from day 1)
7. Publish to npm as alpha

**Exit criteria:** `npx sorry-currents init` in an existing Playwright project generates a working CI workflow + configured reporter. User commits, pushes, and CI runs tests with sorry-currents on the first try.

### Phase 2: Smart Sharding (Weeks 4-5)
**Goal:** The killer feature works end-to-end in GitHub Actions

1. Implement `@sorry-currents/shard-balancer` with LPT algorithm
2. Implement `sorry-currents plan` command
3. Implement `sorry-currents run` command (wraps Playwright with shard plan)
4. Build example GitHub Actions workflow
5. Benchmark: measure improvement over native Playwright sharding
6. Handle cold start gracefully

**Exit criteria:** Demo showing N% faster CI runs vs native sharding on a real test suite.

### Phase 3: Rich Reporting (Weeks 6-8)
**Goal:** Static HTML report that makes users say "I can't go back"

1. Implement `@sorry-currents/html-report`
   - Test results table with sort/filter/search
   - Flaky test highlighting
   - Error clustering
   - Artifact embedding (screenshots, videos, trace links)
   - Shard distribution visualization
2. Implement `sorry-currents report` command
3. Implement `sorry-currents history` command (terminal analytics)
4. Historical comparison (compare current run to previous runs)
5. Build timing-data persistence via CI artifacts pattern

**Exit criteria:** HTML report generated, publishable as CI artifact, visually superior to Playwright's default.

### Phase 4: Integrations (Weeks 9-10)
**Goal:** sorry-currents talks to the tools teams already use

1. GitHub PR comments (`sorry-currents notify --github-comment`)
2. GitHub commit status checks (`sorry-currents notify --github-status`)
3. Slack webhook notifications (`sorry-currents notify --slack`)
4. Generic webhook (`sorry-currents notify --webhook`)
5. Write documentation site (Docusaurus or Starlight)

**Exit criteria:** Full CI workflow working: plan → test → merge → report → notify.

### Phase 5: Polish & Launch (Weeks 11-12)
**Goal:** Production-ready for public announcement

1. Documentation: Getting started guide, CI workflow templates, API reference
2. Example projects (Next.js + Playwright, basic Playwright)
3. README with badges, GIFs, comparison table
4. GitHub Actions action (`uses: sorry-currents/action@v1`) for one-line setup
5. Performance testing at scale (1000+ tests)
6. Logo, branding, landing page (can be simple GitHub Pages)
7. Launch on HN, Reddit r/QualityAssurance, Playwright Discord, Dev.to

---

## Non-Goals for MVP

These are explicitly OUT OF SCOPE to prevent scope creep:

1. **Web dashboard / server component** — The HTML report is static and file-based
2. **Running tests on dev machines as CI replacement** — CI-only for MVP
3. **AI-powered features** — No ML, no LLM integration in MVP
4. **Cypress support** — Playwright only
5. **Real-time streaming** — Results are collected after the fact, not streamed live
6. **User authentication / team management** — No accounts, no login
7. **Test quarantine / skip functionality** — Track flaky tests but don't auto-quarantine
8. **GitLab CI / Jenkins / CircleCI specific integrations** — GitHub Actions first, others follow
9. **Custom Playwright reporter UI (VS Code extension)** — CLI and HTML only
10. **Database backend (Postgres, MySQL, SQLite, etc.)** — CI artifacts and flat JSON files only. Zero infrastructure.

---

## Future Roadmap (Post-MVP)

These features are acknowledged for future development but NOT for initial build:

1. **AI Integration (monetization path):**
   - LLM-powered failure root cause analysis
   - Auto-generated fix suggestions for flaky tests
   - Natural language queries over test history ("show me all tests that started failing after commit X")
   - MCP server for IDE integration
   - *Potential model:* Core OSS + AI features as paid tier or sponsored by cloud provider

2. **GitLab CI / Jenkins / CircleCI support**
3. **Test quarantine / auto-skip for flaky tests**
4. **Datadog / New Relic / Grafana metrics export**
5. **VS Code extension** for viewing results inline
6. **Self-hosted dashboard mode** (optional Docker Compose with SQLite/Postgres)
7. **Cross-branch flaky test detection** (test is flaky on `main` too, not just your PR)
8. **Fail-fast strategy** (cancel remaining tests when N failures detected)
9. **Re-run only failed tests** (smart retry at the CI job level)
10. **Test impact analysis** (only run tests affected by code changes)

---

## Design Patterns & Architecture Principles

### Core Patterns

**1. Result Pattern (no thrown errors for expected failures paths)**

All operations that can fail in expected ways return a discriminated union — never throw for business logic. Exceptions are reserved for truly exceptional, unrecoverable situations (disk full, permissions denied).

```typescript
// packages/core/src/result.ts
type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// Usage — every public function that touches I/O or user input returns Result
async function readTimingData(path: string): Promise<Result<ShardTimingData[]>> {
  // Returns { ok: false, error: ... } on missing file, parse error, etc.
  // Never throws
}
```

**2. Strategy Pattern (shard balancing algorithms)**

The shard balancer must support swappable algorithms without modifying calling code. New strategies are added by implementing the interface and registering them.

```typescript
interface ShardStrategy {
  readonly name: string;
  balance(tests: TestTimingEntry[], shardCount: number): ShardPlan;
}

class LPTStrategy implements ShardStrategy { ... }
class RoundRobinStrategy implements ShardStrategy { ... }
class FileGroupStrategy implements ShardStrategy { ... }

// Registry — strategies keyed by name
const strategies: Map<string, ShardStrategy> = new Map();
```

**3. Builder Pattern (report and notification construction)**

Reports and notification payloads are complex objects assembled in steps. Use builders to enforce construction order and make the code self-documenting.

```typescript
const report = new ReportBuilder()
  .withRunResult(merged)
  .withHistory(history)
  .withArtifacts(artifactPaths)
  .withTheme('dark')
  .build();  // Returns Result<HTMLReport>
```

**4. Observer/Event Emitter Pattern (reporter lifecycle)**

The Playwright reporter emits structured events. Internal components subscribe to these events rather than being called directly. This decouples data collection from data processing.

```typescript
// The reporter emits events
interface ReporterEvents {
  'test:start': (test: TestStartEvent) => void;
  'test:end': (test: TestEndEvent) => void;
  'run:start': (run: RunStartEvent) => void;
  'run:end': (run: RunEndEvent) => void;
}

// Consumers subscribe
eventBus.on('test:end', async (event) => {
  await writeIncrementalResult(event);  // crash-resilient write
});
eventBus.on('test:end', (event) => {
  updateTimingData(event);              // update in-memory timing stats
});
```

**5. Template Method Pattern (CI workflow generation)**

Each CI provider shares a common generation skeleton but differs in syntax. The base class defines the steps; subclasses implement provider-specific rendering.

```typescript
abstract class CIWorkflowGenerator {
  generate(config: InitConfig): Result<GeneratedFile[]> {
    const installStep = this.renderInstallStep(config);
    const testStep = this.renderTestStep(config);
    const artifactStep = this.renderArtifactStep(config);
    const reportStep = this.renderReportStep(config);
    return this.assemble(installStep, testStep, artifactStep, reportStep);
  }

  abstract renderInstallStep(config: InitConfig): string;
  abstract renderTestStep(config: InitConfig): string;
  abstract renderArtifactStep(config: InitConfig): string;
  abstract renderReportStep(config: InitConfig): string;
}

class GitHubActionsGenerator extends CIWorkflowGenerator { ... }
class GitLabCIGenerator extends CIWorkflowGenerator { ... }
```

**6. Adapter Pattern (Playwright version compatibility)**

Playwright's Reporter API may change between versions. An adapter layer normalizes differences so the core logic is version-agnostic.

```typescript
interface PlaywrightAdapter {
  extractTestId(test: TestCase): string;
  extractAttachments(result: TestResult): Attachment[];
  extractErrors(result: TestResult): TestError[];
  getShardInfo(config: FullConfig): ShardInfo | null;
}

// Version-specific adapters
class PlaywrightV1Adapter implements PlaywrightAdapter { ... }  // 1.30+
```

### Architectural Rules

1. **Dependency direction: core ← everything else.** Core has zero imports from other packages. Reporter, CLI, shard-balancer, and html-report all depend on core. No circular dependencies. No package may import from cli.
2. **Pure functions first.** Any function that does computation (shard balancing, error normalization, flaky detection, report data assembly) must be a pure function with no I/O side effects. I/O happens at the boundary.
3. **Composition over inheritance.** Except for the Template Method in CI generators (above), favor composition. No deep class hierarchies.
4. **Single Responsibility per file.** Each file exports one primary thing. A file named `shard-balancer.ts` exports the balancer. Helpers go in separate files.
5. **Barrel exports per package.** Each package has an `index.ts` that re-exports the public API. Internal modules are not accessible from outside the package.

---

## Data Modeling & Validation

### Schema Validation with Zod

All data that crosses a trust boundary (file I/O, CLI input, Playwright API output, environment variables) must be validated at the point of entry using Zod schemas. Internal data passed between pure functions does NOT need runtime validation — TypeScript's type system handles that.

```typescript
// packages/core/src/schemas.ts
import { z } from 'zod';

export const TestResultSchema = z.object({
  id: z.string().min(1),
  file: z.string().min(1),
  title: z.string().min(1),
  project: z.string(),
  status: z.enum(['passed', 'failed', 'timedOut', 'skipped', 'interrupted']),
  duration: z.number().nonnegative(),
  retries: z.number().int().nonnegative(),
  isFlaky: z.boolean(),
  errors: z.array(TestErrorSchema),
  annotations: z.array(AnnotationSchema),
  tags: z.array(z.string()),
  attachments: z.array(AttachmentSchema),
  startedAt: z.string().datetime(),
  workerId: z.number().int().nonnegative(),
  shardIndex: z.number().int().positive().optional(),
});

// Type is DERIVED from schema — single source of truth
export type TestResult = z.infer<typeof TestResultSchema>;

export const RunResultSchema = z.object({ ... });
export type RunResult = z.infer<typeof RunResultSchema>;

// File reading always validates
export async function readRunResult(path: string): Promise<Result<RunResult>> {
  const raw = await readJsonFile(path);
  if (!raw.ok) return raw;
  const parsed = RunResultSchema.safeParse(raw.value);
  if (!parsed.success) {
    return { ok: false, error: AppError.validation(parsed.error, path) };
  }
  return { ok: true, value: parsed.data };
}
```

### Schema Versioning

All persisted files include a schema version. When the schema changes, a migration function transforms old data to the new shape. No data is ever silently dropped.

```typescript
interface VersionedData<T> {
  version: number;         // Monotonically increasing
  generatedBy: string;     // sorry-currents version that wrote this
  timestamp: string;       // ISO 8601
  data: T;
}

// Migration registry
const migrations: Map<number, (data: unknown) => unknown> = new Map([
  [1, migrateV1toV2],
  [2, migrateV2toV3],
]);
```

### Serialization Rules

1. All JSON files are written with 2-space indentation for human readability during debugging
2. Dates are always serialized as ISO 8601 UTC strings — never `Date` objects, never Unix timestamps
3. File paths are always stored relative to the project root, never absolute
4. Binary data (screenshots) is never embedded in JSON — always referenced by relative file path
5. JSON files include a trailing newline

---

## Error Handling Strategy

### Error Taxonomy

```typescript
// packages/core/src/errors.ts
enum ErrorCode {
  // File system
  FILE_NOT_FOUND       = 'FILE_NOT_FOUND',
  FILE_PARSE_ERROR     = 'FILE_PARSE_ERROR',
  FILE_WRITE_ERROR     = 'FILE_WRITE_ERROR',
  PERMISSION_DENIED    = 'PERMISSION_DENIED',

  // Validation
  SCHEMA_VALIDATION    = 'SCHEMA_VALIDATION',
  INVALID_CONFIG       = 'INVALID_CONFIG',
  INVALID_CLI_ARGS     = 'INVALID_CLI_ARGS',

  // Playwright integration
  PLAYWRIGHT_NOT_FOUND = 'PLAYWRIGHT_NOT_FOUND',
  PLAYWRIGHT_VERSION   = 'PLAYWRIGHT_VERSION',
  CONFIG_NOT_FOUND     = 'CONFIG_NOT_FOUND',
  NO_TESTS_FOUND       = 'NO_TESTS_FOUND',

  // Shard balancing
  NO_TIMING_DATA       = 'NO_TIMING_DATA',
  INVALID_SHARD_COUNT  = 'INVALID_SHARD_COUNT',
  SHARD_PLAN_MISMATCH  = 'SHARD_PLAN_MISMATCH',

  // CI / Environment
  CI_NOT_DETECTED      = 'CI_NOT_DETECTED',
  MISSING_ENV_VAR      = 'MISSING_ENV_VAR',
  GIT_NOT_AVAILABLE    = 'GIT_NOT_AVAILABLE',

  // Integrations
  GITHUB_API_ERROR     = 'GITHUB_API_ERROR',
  SLACK_WEBHOOK_ERROR  = 'SLACK_WEBHOOK_ERROR',
  WEBHOOK_ERROR        = 'WEBHOOK_ERROR',
  NETWORK_ERROR        = 'NETWORK_ERROR',

  // Internal
  UNEXPECTED           = 'UNEXPECTED',
}

class AppError {
  constructor(
    readonly code: ErrorCode,
    readonly message: string,
    readonly context?: Record<string, unknown>,  // Structured metadata for debugging
    readonly cause?: Error,                      // Original error chain
  ) {}

  // Factory methods for common errors
  static fileNotFound(path: string): AppError { ... }
  static validation(zodError: ZodError, source: string): AppError { ... }
  static playwrightNotFound(): AppError { ... }

  // Serializable for logging/reporting
  toJSON(): Record<string, unknown> { ... }
}
```

### Error Handling Rules

1. **Reporter errors must NEVER crash test execution.** If the reporter fails to write a file, log a warning and continue. Tests are more important than reporting.

```typescript
// In the reporter — swallow and warn, never throw
onTestEnd(test: TestCase, result: TestResult): void {
  const writeResult = await this.writeTestResult(test, result);
  if (!writeResult.ok) {
    this.logger.warn('Failed to write test result', {
      testId: test.id,
      error: writeResult.error.toJSON(),
    });
    // Continue — do not throw
  }
}
```

2. **CLI commands surface errors as human-readable messages with exit codes.**

```
$ sorry-currents plan --shards 4
✖ No timing data found at .sorry-currents/timing-data.json
  This is expected on the first run. Using native Playwright sharding.
  Hint: Run your tests once to generate timing data for smart balancing.
```

3. **Integration errors (GitHub, Slack) are always non-fatal.** The `notify` command logs the failure and exits 0. Test results are already persisted — notification failure should not fail the CI job.

4. **Validation errors include the path to the invalid data** and, when possible, the expected vs. actual value.

5. **Error context is always structured** (key-value pairs), never string interpolation. This makes errors greppable and machine-parseable.

---

## Logging Strategy

```typescript
// packages/core/src/logger.ts
enum LogLevel {
  DEBUG = 0,
  INFO  = 1,
  WARN  = 2,
  ERROR = 3,
  SILENT = 4,
}

interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}
```

**Rules:**
1. **Default level is `INFO` locally, `WARN` in CI** (auto-detected).
2. **`--verbose` flag sets `DEBUG`; `--quiet` sets `ERROR`; `--silent` sets `SILENT`.**
3. **All log output goes to stderr**, never stdout. Stdout is reserved for machine-readable output (`--format json`, `--output-matrix`, etc.).
4. **Structured context, not string interpolation.** `logger.info('Shard plan generated', { shards: 4, tests: 487 })` not `logger.info(\`Generated plan for 487 tests across 4 shards\`)`.
5. **No log dependency.** The logger is a simple interface with a console-based default implementation. No winston, no pino, no bunyan. Keep it zero-dep.
6. **Logger is injected via constructor**, never imported as a singleton. This makes testing trivial.

---

## Testing Strategy

### Testing Pyramid

```
        ╱╲
       ╱  ╲        E2E Tests (Playwright)
      ╱ E2E╲       - sorry-currents reporting on its own test suite
     ╱──────╲      - Full CLI workflow tests (init → run → merge → report)
    ╱        ╲     - CI workflow validation (act or real GitHub Actions)
   ╱Integration╲
  ╱──────────────╲  Integration Tests (Vitest)
 ╱                ╲ - Reporter + real Playwright (spawned subprocess)
╱    Unit Tests    ╲- Shard balancer + real timing data files
╱────────────────────╲- CLI commands + real file system (in tmp dirs)
                       - HTML report generation + snapshot testing

                      Unit Tests (Vitest)
                      - Pure functions: shard algorithms, error normalization,
                        ID generation, data merging, schema validation
                      - All edge cases, boundary conditions, error paths
                      - Mocked I/O at the boundary
```

### Unit Tests — packages/core, packages/shard-balancer

- **Every pure function has exhaustive tests.** `generateTestId`, `normalizeError`, `detectFlaky`, `mergeRunResults`, all Zod schemas, all LPT algorithm variants.
- **Property-based testing** (with `fast-check`) for the shard balancer: assert that for any input of N tests and M shards, the max shard duration is never more than `optimal + largest_single_test`.
- **Snapshot tests** for error messages and normalized output to catch unintentional changes.
- **Edge cases are first-class:** empty test suites, single test, single shard, 1000+ tests, tests with 0ms duration, tests with unicode/special chars in titles.

```typescript
// Example: shard balancer unit test
describe('LPTStrategy', () => {
  it('balances 4 tests across 2 shards optimally', () => {
    const tests = [
      { testId: 'a', avgDuration: 10000 },
      { testId: 'b', avgDuration: 10000 },
      { testId: 'c', avgDuration: 2000 },
      { testId: 'd', avgDuration: 3000 },
    ];
    const plan = new LPTStrategy().balance(tests, 2);
    // Shard 1: a(10s) + d(3s) = 13s
    // Shard 2: b(10s) + c(2s) = 12s
    // Max shard time: 13s (vs naive 20s)
    expect(plan.maxShardDuration).toBeLessThanOrEqual(13000);
    expect(plan.shards).toHaveLength(2);
  });

  it('handles cold start with no timing data', () => { ... });
  it('handles single test', () => { ... });
  it('handles more shards than tests', () => { ... });
});
```

### Integration Tests — packages/reporter, packages/cli

- **Reporter integration tests** spawn a real Playwright process with a minimal test suite and verify the output files are correct.
- **CLI integration tests** run sorry-currents commands against a temp directory with fixture files and verify outputs.
- **File format tests** validate that generated JSON conforms to the Zod schemas.
- **CI workflow generation tests** validate generated YAML syntax (use `js-yaml` to parse and assert structure).

```typescript
// Example: reporter integration test
describe('SorryCurrentsReporter', () => {
  it('produces valid RunResult JSON for a mixed pass/fail suite', async () => {
    const result = await runPlaywright({
      config: fixtureConfig,
      reporter: '@sorry-currents/reporter',
    });
    const runResult = await readRunResult(
      path.join(result.outputDir, 'run-result.json')
    );
    expect(runResult.ok).toBe(true);
    if (runResult.ok) {
      expect(runResult.value.totalTests).toBe(5);
      expect(runResult.value.flakyTests).toBe(1);
    }
  });
});
```

### E2E Tests — Full Workflow

- **Dogfooding:** The sorry-currents repo uses sorry-currents to report its own CI runs. This is the ultimate E2E test.
- **Workflow tests** use [nektos/act](https://github.com/nektos/act) or similar to validate generated GitHub Actions workflows locally before pushing. (Lower priority — real CI is the source of truth.)
- **Visual regression tests** for the HTML report use Playwright to screenshot the report and compare against baselines.

### Test Fixtures

```
packages/core/src/__fixtures__/
├── run-results/
│   ├── simple-pass.json           # All tests pass
│   ├── mixed-results.json         # Pass, fail, flaky, skip
│   ├── all-fail.json              # Every test fails
│   ├── empty-suite.json           # Zero tests
│   ├── large-suite.json           # 1000+ tests
│   ├── sharded-1-of-4.json       # Shard results for merge testing
│   ├── sharded-2-of-4.json
│   ├── sharded-3-of-4.json
│   └── sharded-4-of-4.json
├── timing-data/
│   ├── normal.json                # Typical timing data
│   ├── skewed.json                # One test 100x longer than others
│   ├── cold-start.json            # Empty / missing
│   └── stale.json                 # Old data, many tests no longer exist
├── playwright-configs/
│   ├── basic.config.ts
│   ├── sharded.config.ts
│   └── multi-project.config.ts
└── errors/
    ├── malformed-json.json        # Invalid JSON
    ├── wrong-schema-v1.json       # Valid JSON, wrong schema
    └── missing-fields.json        # Partial data
```

### Coverage Requirements

- **Core package:** ≥95% branch coverage. This is foundational — bugs here cascade everywhere.
- **Shard balancer:** ≥90% branch coverage + property-based tests for algorithm correctness.
- **Reporter:** ≥80% branch coverage. Some paths require Playwright subprocess testing.
- **CLI:** ≥80% branch coverage. Focus on error paths and edge cases.
- **HTML report:** Visual regression tests take precedence over line coverage.

### Test Naming Convention

```
describe('<UnitUnderTest>', () => {
  describe('<method or scenario>', () => {
    it('should <expected behavior> when <condition>', () => { ... });
    it('should return error when <invalid condition>', () => { ... });
  });
});
```

---

## Technical Constraints & Guidelines

1. **Zero runtime dependencies that require native compilation.** Everything must install cleanly with `npm install` — no node-gyp, no native binaries.
2. **Playwright is a peer dependency, not a regular dependency.** Users bring their own Playwright version. Minimum supported: Playwright 1.30+.
3. **All file I/O must be async and non-blocking.** The reporter must not slow down test execution.
4. **Terminal output must respect `--quiet` and `--json` flags** for CI environments.
5. **All timestamps in ISO 8601 UTC.** No local time zones in stored data.
6. **Error messages must be normalized** before hashing (strip timestamps, UUIDs, port numbers, temp file paths) so the same logical error groups correctly across runs.
7. **The CLI must work offline.** No network calls except for explicit integration commands (notify, webhook).
8. **Support Node.js 20+ only.** Use modern APIs freely.
9. **Use Vitest for all unit/integration tests.** Dogfood Playwright for E2E tests of the reporter itself.
10. **CI artifact-based persistence must be automated by `sorry-currents init`**, not left as copy-paste YAML. The init command generates the complete workflow file. Users should never hand-write artifact upload/download steps.

### Dependency Policy

**Allowed production dependencies** (kept minimal):
- `zod` — schema validation (zero-dep, ~60KB)
- `commander` — CLI parsing (zero-dep, mature)
- `chalk` — terminal colors (pure JS)
- `ora` — spinners (pure JS)
- `cli-table3` — table rendering (pure JS)
- `@octokit/rest` — GitHub API (only imported by integration commands, tree-shakeable)
- `js-yaml` — YAML generation for CI workflows

**Banned:**
- Any package requiring node-gyp or native compilation
- Logging frameworks (winston, pino, bunyan) — use built-in logger
- Express/Fastify/Koa — no HTTP servers
- Any ORM or database driver
- lodash (use native JS/TS equivalents)
- moment/dayjs (use native `Date` + `Intl`)

**Dev dependencies** (no restrictions, but prefer):
- `vitest` for testing
- `fast-check` for property-based testing
- `@playwright/test` for E2E
- `typescript`, `eslint`, `prettier`
- `tsup` for package bundling (ESM output)

### Code Style & Conventions

1. **Strict TypeScript:** `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitReturns: true`. No `any` — use `unknown` and narrow.
2. **Functional core, imperative shell.** Pure functions in the center, I/O at the edges.
3. **Named exports only.** No default exports (except where required by Playwright reporter API).
4. **Explicit return types** on all public functions. Inferred types on private/internal.
5. **No classes unless the pattern demands it** (Strategy, Builder, Template Method). Default to functions + interfaces.
6. **File naming:** kebab-case (`shard-balancer.ts`). One primary export per file.
7. **No barrel re-exports of internal modules.** Each package's `index.ts` explicitly lists its public API.
8. **Comments explain WHY, never WHAT.** The code should be readable without comments. Comments are for business context, trade-off rationale, and non-obvious constraints.
9. **No magic numbers.** Extract constants with descriptive names.
10. **Prefer `readonly` properties and `as const` assertions.** Immutability by default.

---

## Success Metrics

The MVP is successful if:

1. **Setup time < 2 minutes** via `npx sorry-currents init` to working CI pipeline
2. **Smart sharding demonstrates measurable improvement** (target: 20-40% faster than native Playwright sharding on a 100+ test suite)
3. **HTML report loads in < 2 seconds** for a run with 500 tests
4. **Zero infrastructure:** no servers, databases, or external services required for core functionality
5. **GitHub stars trajectory** > 100 in first month (sorry-cypress vibes)
6. **At least 3 external contributors** submit PRs within 60 days of launch
7. **Core package test coverage ≥95%**, all other packages ≥80%

---

## Testing Strategy (Dogfooding)

The sorry-currents project itself must use sorry-currents:

1. The monorepo has a Playwright test suite that tests the HTML report output
2. CI runs use sorry-currents for shard balancing
3. The repository's CI workflow serves as a living example
4. Every PR gets a sorry-currents report comment

This creates a virtuous cycle: any bug in sorry-currents is immediately visible in its own CI.
