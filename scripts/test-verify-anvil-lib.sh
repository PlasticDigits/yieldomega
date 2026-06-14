#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Hermetic smoke for verify_anvil_common.sh + verify_indexer_stack.sh (GitLab #324).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMMON="${ROOT}/scripts/lib/verify_anvil_common.sh"
STACK="${ROOT}/scripts/lib/verify_indexer_stack.sh"

fail() {
  echo "test-verify-anvil-lib: $*" >&2
  exit 1
}

[[ -f "${COMMON}" ]] || fail "missing ${COMMON}"
[[ -f "${STACK}" ]] || fail "missing ${STACK}"

# pkill scope: port-scoped Anvil only (never bare `pkill anvil`).
if ! rg -q 'pkill -f "anvil\.\*\$\{port\}"' "${COMMON}"; then
  fail "verify_anvil_common.sh must use port-scoped anvil pkill"
fi
if rg -q '^[[:space:]]*pkill anvil' "${COMMON}" "${STACK}" 2>/dev/null; then
  fail "must not use bare pkill anvil command"
fi

# Shared libs sourced by ≥5 verify scripts.
count="$(rg -l 'verify_indexer_stack\.sh' "${ROOT}/scripts/verify-"*-anvil.sh 2>/dev/null | wc -l)"
[[ "${count}" -ge 5 ]] || fail "expected ≥5 verify scripts sourcing verify_indexer_stack.sh, got ${count}"

# Legacy TimeCurve post-end script removed.
if [[ -f "${ROOT}/scripts/verify-timecurve-post-end-gates-anvil.sh" ]]; then
  fail "verify-timecurve-post-end-gates-anvil.sh should be deleted"
fi
refs="$(rg 'verify-timecurve-post-end' "${ROOT}" \
  --glob '!audits/**' \
  --glob '!CHANGELOG*' \
  --glob '!scripts/test-verify-anvil-lib.sh' \
  --glob '!docs/testing/e2e-anvil.md' \
  2>/dev/null | wc -l || true)"
[[ "${refs}" -eq 0 ]] || fail "unexpected verify-timecurve-post-end references outside history: ${refs}"

# Hermetic: die prefix + kill guard (no live Anvil).
VERIFY_SCRIPT_PREFIX="test-verify-anvil-lib"
# shellcheck source=scripts/lib/verify_anvil_common.sh
source "${COMMON}"

yieldomega_verify_log "prefix smoke" | grep -q '^test-verify-anvil-lib: prefix smoke' \
  || fail "log prefix"

yieldomega_verify_kill_pid_if_set ""
yieldomega_verify_kill_pid_if_set "0"
yieldomega_verify_kill_pid_if_set "not-a-pid"

echo "test-verify-anvil-lib: PASS (${count} verify scripts use shared stack lib)"
