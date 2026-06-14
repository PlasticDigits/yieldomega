#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Hermetic: explicit export API + caller DOUB unchanged until export (GitLab #289).
# Full double-deploy scope: bash scripts/verify-evm-dev-wallet-seed-anvil.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/anvil_deploy_dev.sh
source "${ROOT}/scripts/lib/anvil_deploy_dev.sh"

SENTINEL_DOUB="0x2222222222222222222222222222222222222222"
DOUB="${SENTINEL_DOUB}"

_stub_deploy_log() {
  local log="$1" doub="$2"
  cat >"${log}" <<EOF
  TimeArena: 0x3333333333333333333333333333333333333333
  PodiumVaults: 0x4444444444444444444444444444444444444444
  ReferralRegistry: 0x6666666666666666666666666666666666666666
  Doubloon: ${doub}
  PlayCred: 0x8888888888888888888888888888888888888888
EOF
}

log1="$(mktemp)"
log2="$(mktemp)"
trap 'rm -f "${log1}" "${log2}"' EXIT

_stub_deploy_log "${log1}" "0x7777777777777777777777777777777777777777"
_stub_deploy_log "${log2}" "0x9999999999999999999999999999999999999999"

[[ "${DOUB}" == "${SENTINEL_DOUB}" ]] || {
  echo "FAIL: caller DOUB changed before any export" >&2
  exit 1
}

yieldomega_export_deploy_addrs_from_log "${log1}" "${ROOT}"
first_doub="${DOUB}"
[[ "${first_doub}" == "0x7777777777777777777777777777777777777777" ]] || {
  echo "FAIL: export did not set DOUB from first log (got ${first_doub})" >&2
  exit 1
}

DOUB="${SENTINEL_DOUB}"
yieldomega_export_deploy_addrs_from_log "${log2}" "${ROOT}"
[[ "${DOUB}" == "0x9999999999999999999999999999999999999999" ]] || {
  echo "FAIL: export did not set DOUB from second log (got ${DOUB})" >&2
  exit 1
}
[[ "${first_doub}" != "${DOUB}" ]] || {
  echo "FAIL: expected distinct Doubloon across two export logs" >&2
  exit 1
}

echo "PASS test-anvil-deploy-caller-scope.sh (explicit export API; see verify-evm-dev-wallet-seed-anvil.sh for deploy)"
