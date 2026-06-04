#!/usr/bin/env bash
# Orchestrates the Skyview E2E suite.
#
# Pre-reqs (you bring these up; this script DOES NOT touch them):
#   - Cortex on :4000 + cortex-postgres on :5432 + cortex-redis on :6379
#   - Skyview vite dev server on :5001
#
# What this script DOES manage:
#   - Brings up cortex-byodb-test on :5434 (for the V2 migrate spec)
#   - Tears it down at the end
#
# Data created in the local DB is INTENTIONALLY LEFT BEHIND so you can
# browse the new TestCo-<timestamp> in Skyview after.

set -u
cd "$(dirname "$0")"

green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
red() { printf '\033[31m%s\033[0m\n' "$*"; }

# ── 1. Sanity-check the stack ────────────────────────────────────────────
green "▶ Checking running services"
if ! curl -sS -o /dev/null -w '' http://localhost:5001 2>/dev/null; then
  red "Skyview is not reachable on http://localhost:5001 — run \`npm run dev\` first"
  exit 1
fi
if ! curl -sS -o /dev/null http://localhost:4000/health 2>/dev/null; then
  red "Cortex is not reachable on http://localhost:4000 — start it first"
  exit 1
fi
if ! docker ps --format '{{.Names}}' | grep -q '^cortex-postgres$'; then
  red "cortex-postgres container is not running"
  exit 1
fi
green "  ✓ Skyview :5001, Cortex :4000, cortex-postgres up"

# ── 2. byo-db Postgres on :5434 ───────────────────────────────────────────
BYO_NAME=cortex-byodb-test
if docker ps --format '{{.Names}}' | grep -q "^${BYO_NAME}$"; then
  yellow "  ⚠ ${BYO_NAME} already running — reusing"
else
  green "▶ Starting ${BYO_NAME} on :5434"
  docker run -d --rm \
    --name "${BYO_NAME}" \
    --network cortex_default \
    -p 5434:5432 \
    -e POSTGRES_USER=byo \
    -e POSTGRES_PASSWORD=byo \
    -e POSTGRES_DB=byo \
    postgres:17 >/dev/null
  # wait for ready
  for i in {1..30}; do
    if docker exec "${BYO_NAME}" pg_isready -U byo -d byo >/dev/null 2>&1; then break; fi
    sleep 1
  done
  green "  ✓ ${BYO_NAME} ready"
fi

cleanup() {
  if [[ "${KEEP_BYODB:-0}" != "1" ]]; then
    green "▶ Tearing down ${BYO_NAME}"
    docker rm -f "${BYO_NAME}" >/dev/null 2>&1 || true
  else
    yellow "  ⚠ KEEP_BYODB=1 — leaving ${BYO_NAME} running"
  fi
}
trap cleanup EXIT

# ── 3. Run Playwright specs ──────────────────────────────────────────────
green "▶ Running Playwright specs"
npx playwright test --reporter=list
PW_STATUS=$?

# ── 4. Fake-customer SDK + webhook script ────────────────────────────────
green "▶ Running fake-customer SDK script"
node e2e/sdk/fake-customer.mjs
SDK_STATUS=$?

# ── 5. Summary ───────────────────────────────────────────────────────────
echo
green "═══════════════════════════════════════════════════════════"
if [[ $PW_STATUS -eq 0 && $SDK_STATUS -eq 0 ]]; then
  green "✓ E2E suite passed"
else
  yellow "⚠ Playwright=${PW_STATUS}  SDK=${SDK_STATUS}"
fi
RUN_ID=$(cat e2e/.state/run.json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('runId','?'))" 2>/dev/null || echo '?')
COMPANY=$(cat e2e/.state/run.json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['owner'].get('companyName','?'))" 2>/dev/null || echo '?')
green "  Run ID:  ${RUN_ID}"
green "  Company: ${COMPANY}"
green "  → log in to Skyview as admin@trueyy.com to see it under Companies"
green "═══════════════════════════════════════════════════════════"

exit $(( PW_STATUS | SDK_STATUS ))
