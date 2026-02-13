# sorry-currents

**Free, open-source Playwright test orchestration. No cloud required.**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![npm](https://img.shields.io/npm/v/@sorry-currents/cli.svg)](https://www.npmjs.com/package/@sorry-currents/cli)

sorry-currents is a CLI-native, zero-infrastructure alternative to [Currents.dev](https://currents.dev) for Playwright test orchestration. It plugs into Playwright's Custom Reporter API, persists data via CI artifacts, and provides:

- **Smart shard balancing** — LPT algorithm with variance-aware estimates, saving 20-40% CI time vs native Playwright sharding
- **Enhanced HTML reports** — flaky test highlighting, error clustering, shard distribution visualization, historical trends
- **Flaky test detection** — automatic detection of tests that pass on retry
- **Zero infrastructure** — no servers, no databases, no Docker. CI artifacts are the persistence layer.
- **Full CI integration** — GitHub PR comments, commit status checks, Slack notifications, generic webhooks

## Quick Start

```bash
# 1. Install
npm install --save-dev @sorry-currents/cli @sorry-currents/reporter

# 2. Initialize (auto-detects your setup, generates CI workflow)
npx sorry-currents init

# 3. Commit and push — CI runs with smart sharding automatically
git add -A && git commit -m "feat: add sorry-currents" && git push
```

That's it. First run uses naive sharding (cold start). From the second run onward, smart shard balancing kicks in automatically using timing data from the previous run.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    CI Pipeline                               │
│                                                              │
│  ┌──────────┐    ┌──────────────┐    ┌────────────────┐     │
│  │   plan   │───▶│  test (N     │───▶│    report      │     │
│  │          │    │  shards)     │    │                │     │
│  │ Reads    │    │ Each shard   │    │ Merge results  │     │
│  │ timing   │    │ runs its     │    │ Generate HTML  │     │
│  │ data     │    │ assigned     │    │ Update timing  │     │
│  │ from     │    │ tests        │    │ data for next  │     │
│  │ previous │    │              │    │ run            │     │
│  │ run      │    │              │    │                │     │
│  └──────────┘    └──────────────┘    └────────────────┘     │
│       ▲                                      │              │
│       └──────────── timing-data.json ────────┘              │
└─────────────────────────────────────────────────────────────┘
```

1. **`sorry-currents plan`** reads historical timing data and generates an optimal shard plan using the LPT (Longest Processing Time First) algorithm
2. **Each CI shard** runs only its assigned test files via `sorry-currents run`
3. **`sorry-currents merge`** combines shard results and updates timing data for the next run
4. **`sorry-currents report`** generates an HTML report with error clustering, flaky test detection, and shard distribution visualization
5. **`sorry-currents notify`** posts results to GitHub PRs, Slack, or webhooks

## Commands

| Command | Description |
|---------|-------------|
| `sorry-currents init` | Interactive onboarding wizard — generates CI workflow + reporter config |
| `sorry-currents plan` | Generate optimized shard execution plan |
| `sorry-currents run` | Run Playwright tests with sorry-currents reporter |
| `sorry-currents merge` | Merge multi-shard results into a single run |
| `sorry-currents report` | Generate HTML/JSON/Markdown reports |
| `sorry-currents history` | View test analytics from the terminal |
| `sorry-currents notify` | Send results to GitHub, Slack, or webhooks |

## Variance-Aware Balancing

sorry-currents tracks the standard deviation of each test's execution time across runs. The `--risk-factor` flag pads duration estimates by `k × σ`, so high-variance tests get more shard time budget:

```bash
sorry-currents plan --target-duration 30 --risk-factor 1
```

- `--risk-factor 0` — use average duration only
- `--risk-factor 1` — pad by 1σ (recommended, default)
- `--risk-factor 2` — pad by 2σ (conservative)

## Why Not Currents.dev?

| Feature | Currents.dev | sorry-currents |
|---------|-------------|----------------|
| Smart sharding | ✅ Dynamic | ✅ Static LPT + variance |
| Infrastructure | Cloud SaaS | None (CI artifacts) |
| Cost | $49+/month | Free (MIT) |
| Test volume limits | Per-plan | Unlimited |
| Flaky test detection | ✅ | ✅ |
| PR comments | ✅ | ✅ |
| HTML reports | ✅ Dashboard | ✅ Static HTML |
| Error clustering | ✅ | ✅ |
| Historical trends | ✅ | ✅ |
| Offline capable | ❌ | ✅ |
| Self-hosted | ❌ | N/A (no server) |

## Packages

This is a monorepo with 5 packages:

| Package | Description | npm |
|---------|-------------|-----|
| [`@sorry-currents/cli`](packages/cli) | CLI binary — entry point for all commands | [![npm](https://img.shields.io/npm/v/@sorry-currents/cli.svg)](https://www.npmjs.com/package/@sorry-currents/cli) |
| [`@sorry-currents/reporter`](packages/reporter) | Custom Playwright Reporter | [![npm](https://img.shields.io/npm/v/@sorry-currents/reporter.svg)](https://www.npmjs.com/package/@sorry-currents/reporter) |
| [`@sorry-currents/core`](packages/core) | Shared types, schemas, utilities | [![npm](https://img.shields.io/npm/v/@sorry-currents/core.svg)](https://www.npmjs.com/package/@sorry-currents/core) |
| [`@sorry-currents/shard-balancer`](packages/shard-balancer) | Smart test distribution engine | [![npm](https://img.shields.io/npm/v/@sorry-currents/shard-balancer.svg)](https://www.npmjs.com/package/@sorry-currents/shard-balancer) |
| [`@sorry-currents/html-report`](packages/html-report) | Static HTML report generator | [![npm](https://img.shields.io/npm/v/@sorry-currents/html-report.svg)](https://www.npmjs.com/package/@sorry-currents/html-report) |

## CI Workflow Example (GitHub Actions)

```yaml
name: Playwright Tests
on:
  push:
    branches: [main]
  pull_request:

jobs:
  plan:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.plan.outputs.matrix }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - name: Download previous timing data
        uses: actions/download-artifact@v4
        with:
          name: sorry-currents-timing
          path: .sorry-currents/
        continue-on-error: true
      - name: Generate shard plan
        id: plan
        run: npx @sorry-currents/cli plan --target-duration 30 --max-shards 8 --risk-factor 1 --output-matrix

  test:
    needs: plan
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix: ${{ fromJson(needs.plan.outputs.matrix) }}
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npx playwright install --with-deps
      - run: npx @sorry-currents/cli run --shard-plan .sorry-currents/shard-plan.json --shard-index ${{ matrix.shardIndex }}
      - uses: actions/upload-artifact@v4
        with:
          name: sorry-currents-shard-${{ matrix.shardIndex }}
          path: .sorry-currents/runs/

  report:
    needs: test
    if: always()
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          pattern: sorry-currents-shard-*
          path: .sorry-currents/shards/
      - run: |
          npx @sorry-currents/cli merge
          npx @sorry-currents/cli report --format html
      - uses: actions/upload-artifact@v4
        with:
          name: sorry-currents-timing
          path: .sorry-currents/timing-data.json
          retention-days: 90
      - uses: actions/upload-artifact@v4
        with:
          name: sorry-currents-html-report
          path: .sorry-currents/report/
```

## Development

```bash
# Prerequisites: Node.js 20+, pnpm 9+
pnpm install
pnpm build        # Build all packages
pnpm test         # Run all tests
pnpm typecheck    # Type-check all packages
```

## Tech Stack

- **Runtime:** Node.js 20+, TypeScript 5+ (strict mode)
- **Module system:** ESM-only
- **Build:** tsup (esbuild-based)
- **Package manager:** pnpm workspaces
- **Testing:** Vitest + fast-check (property-based)
- **Playwright:** Peer dependency (users bring their own, minimum 1.30+)

## License

[MIT](LICENSE)
