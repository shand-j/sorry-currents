# @sorry-currents/shard-balancer

Smart test distribution engine for sorry-currents. Analyzes historical test timing data and generates optimal shard assignments that minimize total wall-clock CI time.

## The Problem

Playwright's native `--shard=x/y` distributes test files evenly by **count**, not by **duration**. If you have files taking [10min, 10min, 2min, 3min] across 2 shards, native sharding might put both 10min files on the same shard — 20min vs 5min. That's 15 minutes wasted.

## The Solution

sorry-currents uses historical duration data to solve this as a bin-packing problem:

1. Read `timing-data.json` (average durations per test/file from previous runs)
2. Apply the **Longest Processing Time First (LPT)** algorithm
3. Output a shard plan with balanced estimated durations

## Installation

```bash
npm install @sorry-currents/shard-balancer
```

## API

### Strategies

Three balancing strategies, selectable via the Strategy pattern:

| Strategy | Class | Description |
|----------|-------|-------------|
| `lpt` | `LPTStrategy` | Longest Processing Time First — assigns longest tests to lightest shards. **Default and recommended.** |
| `round-robin` | `RoundRobinStrategy` | Distributes tests cyclically. Simple but less optimal. |
| `file-group` | `FileGroupStrategy` | Groups tests by file, then balances files across shards. |

```typescript
import { getStrategy, listStrategies } from '@sorry-currents/shard-balancer';

const strategy = getStrategy('lpt');    // Returns LPTStrategy instance
const names = listStrategies();         // ['lpt', 'round-robin', 'file-group']
```

### Core Functions

```typescript
import {
  timingDataToEntries,
  calculateOptimalShardCount,
  computePessimisticDuration,
} from '@sorry-currents/shard-balancer';

// Convert timing data to balancer input entries
const entries = timingDataToEntries(timingData, defaultDuration, riskFactor);

// Auto-calculate optimal shard count for a target duration
const shards = calculateOptimalShardCount(entries, targetDurationMs, maxShards);

// Compute risk-adjusted duration: avg + k * stdDev
const pessimistic = computePessimisticDuration(5000, 1000, 1); // → 6000
```

### Variance-Aware Balancing

The balancer supports **risk-adjusted estimates** via the `riskFactor` parameter:

- `riskFactor = 0` — use average duration only (classic mode)
- `riskFactor = 1` — pad by 1 standard deviation (~68th percentile)
- `riskFactor = 2` — pad by 2 standard deviations (~95th percentile)

High-variance tests get more shard time budget, preventing a single slow outlier from becoming the bottleneck.

## Algorithm

The LPT algorithm (default):

1. Aggregate test entries by file (Playwright shards at file level)
2. Sort files by total estimated duration **descending**
3. For each file, assign to the shard with the **lowest current load**
4. Output: `ShardPlan` with balanced shard assignments

This produces near-optimal results for most real-world test suites.
