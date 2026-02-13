# @sorry-currents/cli

CLI-native, zero-infrastructure Playwright test orchestration. The `sorry-currents` command is the entry point for all user interactions.

## Installation

```bash
npm install -g @sorry-currents/cli
# or use npx
npx @sorry-currents/cli <command>
```

## Commands

### `sorry-currents init`

Interactive onboarding wizard. Auto-detects CI provider, package manager, and Playwright config. Generates working CI workflow + reporter configuration.

```bash
sorry-currents init
sorry-currents init --ci github-actions --shards 4 --skip-prompts
sorry-currents init --dry-run  # Preview without writing files
```

### `sorry-currents plan`

Generate an optimized shard execution plan from historical timing data.

```bash
sorry-currents plan --shards 4
sorry-currents plan --target-duration 30 --max-shards 8
sorry-currents plan --output-matrix          # GitHub Actions matrix JSON
sorry-currents plan --risk-factor 1          # Variance-aware padding
sorry-currents plan --strategy round-robin   # Alternative strategy
sorry-currents plan --test-dir src/tests     # Discover test files from directory
```

| Option | Default | Description |
|--------|---------|-------------|
| `--shards <n>` | — | Fixed shard count (overrides `--target-duration`) |
| `--target-duration <s>` | — | Target wall-clock seconds per shard (auto-calculates count) |
| `--max-shards <n>` | `10` | Maximum shards when using `--target-duration` |
| `--risk-factor <k>` | `1` | Variance padding multiplier (0=avg only, 1=+1σ, 2=+2σ) |
| `--timing <path>` | `.sorry-currents/timing-data.json` | Path to timing data |
| `--test-dir <dir>` | — | Directory to discover test files from |
| `--output <path>` | stdout | Write plan to file |
| `--output-matrix` | `false` | Output GitHub Actions matrix JSON |
| `--strategy <name>` | `lpt` | Balancing strategy: `lpt`, `round-robin`, `file` |
| `--default-timeout <ms>` | `30000` | Estimated duration for tests without history |

### `sorry-currents run`

Run Playwright tests with sorry-currents reporter auto-configured.

```bash
sorry-currents run --shard-plan shard-plan.json --shard-index 1
sorry-currents run -- --config=custom.config.ts --workers 4
```

### `sorry-currents merge`

Merge results from multiple shards into a single run result. Also generates updated timing data for the next run's shard balancer.

```bash
sorry-currents merge
sorry-currents merge --input .sorry-currents/shards --output .sorry-currents
```

### `sorry-currents report`

Generate reports from run results.

```bash
sorry-currents report --format html
sorry-currents report --format json
sorry-currents report --history --open
```

### `sorry-currents history`

View test history and analytics from the terminal.

```bash
sorry-currents history --flaky           # Flakiest tests
sorry-currents history --slow --limit 10 # Slowest tests
sorry-currents history --failing         # Most failing tests
sorry-currents history --format json     # Machine-readable output
```

### `sorry-currents notify`

Send run results to integrations, Non-fatal - integration errors exit 0.

```bash
sorry-currents notify --github-comment   # PR comment (requires GITHUB_TOKEN)
sorry-currents notify --github-status    # Commit status check
sorry-currents notify --slack <url>      # Slack webhook
sorry-currents notify --webhook <url>    # Generic HTTP POST
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Test failures detected |
| `2` | sorry-currents operational error |

## CI Usage Example (GitHub Actions)

```yaml
- name: Generate shard plan
  run: npx @sorry-currents/cli plan --target-duration 30 --max-shards 8 --risk-factor 1 --output-matrix

- name: Run tests
  run: npx @sorry-currents/cli run --shard-plan shard-plan.json --shard-index ${{ matrix.shardIndex }}

- name: Merge results
  run: npx @sorry-currents/cli merge

- name: Generate report
  run: npx @sorry-currents/cli report --format html
```
