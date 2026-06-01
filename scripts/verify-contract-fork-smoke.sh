#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# GitLab #275 — TimeArenaFork.t.sol optional RPC fork smoke (INV-CONTRACTS-275-FORK-SMOKE).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS="${ROOT}/contracts"
SAVED_FORK_URL="${FORK_URL:-}"
SAVED_TIME_ARENA_FORK_ADDRESS="${TIME_ARENA_FORK_ADDRESS:-}"

die() {
  echo "verify-contract-fork-smoke: $*" >&2
  exit 1
}

log() {
  echo "verify-contract-fork-smoke: $*"
}

assert_no_timecurve_fork_refs() {
  local hits
  hits="$(
    rg -l 'TimeCurveFork(Test|\.t\.sol)' \
      "${ROOT}/.github/workflows/contract-fork-smoke.yml" \
      "${CONTRACTS}/README.md" \
      "${CONTRACTS}/.env.example" 2>/dev/null || true
  )"
  if [[ -n "${hits}" ]]; then
    die "legacy TimeCurveFork references remain in: ${hits}"
  fi
}

log "Checking workflow/README/.env.example for retired TimeCurveFork naming..."
assert_no_timecurve_fork_refs

cd "${CONTRACTS}"

log "Running TimeArenaForkTest with FORK_URL unset (expect no-op pass)..."
unset FORK_URL
unset TIME_ARENA_FORK_ADDRESS
FOUNDRY_PROFILE=ci forge test --match-contract TimeArenaForkTest -vv

if [[ -n "${SAVED_FORK_URL}" ]]; then
  log "Running TimeArenaForkTest with FORK_URL set (live RPC connectivity)..."
  export FORK_URL="${SAVED_FORK_URL}"
  if [[ -n "${SAVED_TIME_ARENA_FORK_ADDRESS}" ]]; then
    export TIME_ARENA_FORK_ADDRESS="${SAVED_TIME_ARENA_FORK_ADDRESS}"
  fi
  FOUNDRY_PROFILE=ci forge test --match-contract TimeArenaForkTest -vv
else
  log "Skipping live RPC fork (export FORK_URL=<rpc> to exercise connectivity)."
fi

echo "=== verify-contract-fork-smoke: OK ==="
