#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Install Multicall3 at the canonical address on a fresh Anvil instance (GitLab #307).
#
# Fresh Anvil has no bytecode at 0xcA11…; chain-timer Multicall3 batching needs this for local verify/benchmark scripts.
# Production chains already deploy Multicall3 at this address.
set -euo pipefail

yieldomega_anvil_install_multicall3() {
  local rpc="${1:?yieldomega_anvil_install_multicall3: need RPC URL}"
  local lib_dir
  lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local bytecode_file="${lib_dir}/multicall3_anvil_bytecode.hex"
  local multicall3="0xcA11bde05977b3631167028862bE2a173976CA11"

  if [[ ! -f "${bytecode_file}" ]]; then
    echo "yieldomega_anvil_install_multicall3: missing ${bytecode_file}" >&2
    return 1
  fi

  local existing
  existing="$(cast code "${multicall3}" --rpc-url "${rpc}" 2>/dev/null || echo "0x")"
  if [[ "${existing}" != "0x" && "${existing}" != "0x0" ]]; then
    return 0
  fi

  local bytecode
  bytecode="$(tr -d '\n\r ' < "${bytecode_file}")"
  cast rpc anvil_setCode "${multicall3}" "${bytecode}" --rpc-url "${rpc}" >/dev/null
  echo "yieldomega_anvil_install_multicall3: installed Multicall3 at ${multicall3}"
}
