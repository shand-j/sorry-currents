#!/usr/bin/env bash
#
# Local CI simulator for sorry-currents workflows.
# Mirrors the GitHub Actions pipeline on your machine.
#
# Usage:
#   scripts/local-ci.sh                     # sorry-currents sharded pipeline (default)
#   scripts/local-ci.sh --baseline          # baseline (native Playwright sharding)
#   scripts/local-ci.sh --shards 4          # override shard count
#   scripts/local-ci.sh --skip-build        # skip build step (use existing dist/)
#   scripts/local-ci.sh --step plan         # run only a specific step
#   scripts/local-ci.sh --step test         # run only test step
#   scripts/local-ci.sh --step report       # run only merge + report step
#   scripts/local-ci.sh --help

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
E2E_DIR="$ROOT_DIR/playwright-e2e"
RUN_ID="local-$(date +%s)"
SHARD_COUNT=3
SKIP_BUILD=false
BASELINE=false
STEP="all"

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

banner()  { echo -e "\n${BLUE}${BOLD}▸ $1${RESET}"; }
step()    { echo -e "  ${CYAN}→${RESET} $1"; }
ok()      { echo -e "  ${GREEN}✓${RESET} $1"; }
warn()    { echo -e "  ${YELLOW}⚠${RESET} $1"; }
fail()    { echo -e "  ${RED}✗${RESET} $1"; }
info()    { echo -e "  ${DIM}$1${RESET}"; }

# ── Parse args ──────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --baseline)    BASELINE=true; shift ;;
    --shards)      SHARD_COUNT="$2"; shift 2 ;;
    --skip-build)  SKIP_BUILD=true; shift ;;
    --step)        STEP="$2"; shift 2 ;;
    --run-id)      RUN_ID="$2"; shift 2 ;;
    --help|-h)
      head -14 "$0" | tail -12 | sed 's/^# *//'
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 2 ;;
  esac
done

# ── Validate ────────────────────────────────────────────────────────────────
if [[ ! -d "$E2E_DIR" ]]; then
  fail "playwright-e2e directory not found at $E2E_DIR"
  exit 2
fi

# ── Step: build ─────────────────────────────────────────────────────────────
do_build() {
  banner "BUILD"
  if $SKIP_BUILD; then
    warn "Skipping build (--skip-build)"
    return
  fi
  step "pnpm install"
  (cd "$ROOT_DIR" && pnpm install --frozen-lockfile 2>&1 | tail -1)
  step "Building sorry-currents packages..."
  (cd "$ROOT_DIR" && pnpm -r --filter '!playwright-e2e' build 2>&1 | grep -E '(Build success|Done in|error)' || true)
  ok "Build complete"
}

# ── Step: plan ──────────────────────────────────────────────────────────────
do_plan() {
  banner "PLAN (shards=$SHARD_COUNT)"
  step "Generating shard plan..."
  (cd "$E2E_DIR" && npx sorry-currents plan --shards "$SHARD_COUNT" --output .sorry-currents/shard-plan.json 2>&1) || true
  if [[ -f "$E2E_DIR/.sorry-currents/shard-plan.json" ]]; then
    ok "Shard plan written to .sorry-currents/shard-plan.json"
  else
    warn "No shard plan generated (cold start — will use native Playwright sharding)"
  fi
}

# ── Step: test (sorry-currents) ─────────────────────────────────────────────
do_test() {
  banner "TEST ($SHARD_COUNT shards, run=$RUN_ID)"
  local any_failed=false

  for i in $(seq 1 "$SHARD_COUNT"); do
    step "Running shard $i/$SHARD_COUNT..."
    local exit_code=0

    if [[ -f "$E2E_DIR/.sorry-currents/shard-plan.json" ]]; then
      (cd "$E2E_DIR" && \
        SORRY_CURRENTS_RUN_ID="$RUN_ID" \
        npx sorry-currents run \
          --shard-plan .sorry-currents/shard-plan.json \
          --shard-index "$i" \
      ) || exit_code=$?
    else
      (cd "$E2E_DIR" && \
        SORRY_CURRENTS_RUN_ID="$RUN_ID" \
        SORRY_CURRENTS_SHARD_TOTAL="$SHARD_COUNT" \
        npx sorry-currents run --shard-index "$i" \
      ) || exit_code=$?
    fi

    case $exit_code in
      0) ok "Shard $i passed" ;;
      1) warn "Shard $i finished with test failures (exit 1)"; any_failed=true ;;
      *) fail "Shard $i failed with exit code $exit_code"; any_failed=true ;;
    esac
  done

  if $any_failed; then
    warn "Some shards had failures (this is expected if tests hit external sites)"
  else
    ok "All shards passed"
  fi
}

# ── Step: test (baseline) ──────────────────────────────────────────────────
do_test_baseline() {
  banner "TEST - BASELINE ($SHARD_COUNT shards, native Playwright sharding)"
  local any_failed=false

  for i in $(seq 1 "$SHARD_COUNT"); do
    step "Running shard $i/$SHARD_COUNT (native)..."
    local exit_code=0
    (cd "$E2E_DIR" && \
      npx playwright test \
        --config=playwright.baseline.config.ts \
        "--shard=$i/$SHARD_COUNT" \
    ) || exit_code=$?

    case $exit_code in
      0) ok "Shard $i passed" ;;
      1) warn "Shard $i finished with test failures (exit 1)"; any_failed=true ;;
      *) fail "Shard $i failed with exit code $exit_code"; any_failed=true ;;
    esac
  done

  if $any_failed; then
    warn "Some shards had failures"
  else
    ok "All shards passed"
  fi
}

# ── Step: report ────────────────────────────────────────────────────────────
do_report() {
  banner "MERGE & REPORT"

  step "Merging shard results..."
  (cd "$E2E_DIR" && npx sorry-currents merge --input .sorry-currents/runs)

  step "Generating HTML report..."
  (cd "$E2E_DIR" && npx sorry-currents report --format html)

  step "Generating markdown summary..."
  echo ""
  (cd "$E2E_DIR" && npx sorry-currents report --format markdown)
  echo ""

  local report_path="$E2E_DIR/.sorry-currents/report/index.html"
  if [[ -f "$report_path" ]]; then
    ok "HTML report: $report_path"
  fi
}

# ── Clean ───────────────────────────────────────────────────────────────────
do_clean() {
  step "Cleaning previous results..."
  rm -rf "$E2E_DIR/.sorry-currents/runs" \
         "$E2E_DIR/.sorry-currents/shards" \
         "$E2E_DIR/.sorry-currents/report" \
         "$E2E_DIR/.sorry-currents/merged-run-result.json"
  ok "Cleaned .sorry-currents/"
}

# ── Main ────────────────────────────────────────────────────────────────────
echo -e "${BOLD}sorry-currents local CI simulator${RESET}"
echo -e "${DIM}─────────────────────────────────${RESET}"

if $BASELINE; then
  info "Mode: baseline (no sorry-currents)"
else
  info "Mode: sorry-currents sharding"
fi
info "Shards: $SHARD_COUNT"
info "Run ID: $RUN_ID"
echo ""

START_TIME=$SECONDS

case $STEP in
  all)
    do_build
    if $BASELINE; then
      do_clean
      do_test_baseline
    else
      do_clean
      do_plan
      do_test
      do_report
    fi
    ;;
  build)   do_build ;;
  plan)    do_plan ;;
  test)
    if $BASELINE; then
      do_test_baseline
    else
      do_test
    fi
    ;;
  report)  do_report ;;
  clean)   do_clean ;;
  *)
    fail "Unknown step: $STEP (use: build, plan, test, report, clean)"
    exit 2
    ;;
esac

ELAPSED=$(( SECONDS - START_TIME ))
echo ""
echo -e "${BOLD}Done in ${ELAPSED}s${RESET}"
