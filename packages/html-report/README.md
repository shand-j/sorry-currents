# @sorry-currents/html-report

Static HTML report generator for sorry-currents. Produces a single self-contained HTML file with inline CSS/JS — no server required.

## Features

- **Flaky test highlighting** — amber/yellow visual treatment for tests that passed on retry
- **Error clustering** — groups failures by normalized error message with occurrence counts
- **Shard distribution visualization** — shows test distribution and per-shard wall time
- **Historical comparison** — "This test was 2x slower than average" trends
- **Search and filter** — find tests by name, status, or error message
- **Dark mode** — automatic or manual toggle
- **Responsive** — works on mobile for on-the-go debugging
- **< 500KB** — lightweight, loads instantly

## Installation

```bash
npm install @sorry-currents/html-report
```

## Usage

### Via CLI (recommended)

```bash
sorry-currents report --format html
sorry-currents report --format html --history --open
```

### Programmatic API

```typescript
import { ReportBuilder, generateHtmlReport } from '@sorry-currents/html-report';

// Quick generation
const result = generateHtmlReport(runResult);

// Builder pattern for full control
const result = new ReportBuilder()
  .withRunResult(mergedRunResult)
  .withHistory(testHistory)
  .withErrorClusters(errorClusters)
  .withOptions({
    title: 'My Test Report',
    theme: 'dark',
    artifactBaseUrl: 'https://artifacts.example.com/',
  })
  .build();

if (result.ok) {
  fs.writeFileSync('report.html', result.value);
}
```

## Report Tabs

| Tab | Contents |
|-----|----------|
| **Tests** | All test results with status, duration, sortable columns |
| **Errors** | Clustered error messages with counts and example stacks |
| **Shards** | Shard distribution visualization with duration bars |
| **Flaky** | Flaky tests with flakiness rates and retry counts |
| **History** | Duration trends and pass-rate trends per test |

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `title` | `string` | `'sorry-currents Test Report'` | Report page title |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Color theme |
| `artifactBaseUrl` | `string` | `undefined` | Base URL for artifact links |
