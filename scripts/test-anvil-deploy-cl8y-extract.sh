#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Regression: MockReserveCl8y address extraction from DeployDev logs + broadcast (#279).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/lib/anvil_deploy_dev.sh
source "${ROOT}/scripts/lib/anvil_deploy_dev.sh"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

WANT="0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"

# Canonical DeployDev log line (GitLab #279).
cat >"$tmp" <<EOF
  MockReserveCl8y: ${WANT}
  Doubloon: 0x5FbDB2315678afecb367f032d93F642f64180aa3
  E2E mock wallet seeded with MockReserveCl8y
EOF
got="$(_yieldomega_extract_addr_from_log "$tmp" "MockReserveCl8y")"
[[ "${got}" == "${WANT}" ]] || fail "canonical log: got ${got}, want ${WANT}"

# Legacy forge log (address on same line as verbose label).
cat >"$tmp" <<EOF
  MockReserveCl8y deployed (dev only): ${WANT}
  MockReserveCl8y seeded for E2E mock wallet
EOF
got="$(_yieldomega_extract_addr_from_log "$tmp" "MockReserveCl8y")"
[[ "${got}" == "${WANT}" ]] || fail "legacy log: got ${got}, want ${WANT}"

# Address-only on following line (no hex on label line).
cat >"$tmp" <<EOF
  MockReserveCl8y deployed (dev only):
  ${WANT}
  MockReserveCl8y seeded for E2E mock wallet
EOF
got="$(_yieldomega_extract_addr_from_log "$tmp" "MockReserveCl8y")"
[[ -z "${got}" ]] || fail "split-line legacy log should miss without broadcast fallback, got ${got}"

# Broadcast fallback fixture.
fixture="${ROOT}/scripts/fixtures/deploy-dev-mock-cl8y-broadcast.json"
[[ -f "${fixture}" ]] || fail "missing fixture ${fixture}"
got="$(_yieldomega_extract_mock_cl8y_from_broadcast "${fixture}")"
[[ "${got}" == "${WANT}" ]] || fail "broadcast fixture: got ${got}, want ${WANT}"

# Broadcast fallback via temp repo root layout.
tmp_root="$(mktemp -d)"
mkdir -p "${tmp_root}/contracts/broadcast/DeployDev.s.sol/31337"
cp "${fixture}" "${tmp_root}/contracts/broadcast/DeployDev.s.sol/31337/run-latest.json"
cat >"$tmp" <<EOF
  Doubloon: 0x5FbDB2315678afecb367f032d93F642f64180aa3
EOF
got="$(_yieldomega_resolve_mock_cl8y_addr "$tmp" "${tmp_root}")"
[[ "${got}" == "${WANT}" ]] || fail "resolve via broadcast: got ${got}, want ${WANT}"
rm -rf "${tmp_root}"

echo "ok test-anvil-deploy-cl8y-extract (#279)"
