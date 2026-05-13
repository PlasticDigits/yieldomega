#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Resolve **ERC1967 proxy** addresses from a Forge broadcast `run-*.json` (e.g. `DeployDev.s.sol`
# or `DeployProduction.s.sol`).
#
# Foundry records the **implementation** CREATE with `contractName` "TimeCurve", "RabbitTreasury",
# etc. The address integrators must use is the **ERC1967Proxy** whose constructor `arguments[0]`
# equals that implementation (GitLab #61, UUPS migration GitLab #54).
#
# Usage (after `source`):
#   broadcast_erc1967_proxy_address "$RUN_JSON" TimeCurve
#   broadcast_erc1967_proxy_address "$RUN_JSON" RabbitTreasury
#   broadcast_direct_create_address "$RUN_JSON" LeprechaunNFT

broadcast_erc1967_proxy_address() {
  local RUN="$1"
  local IMPL_NAME="$2"
  local impl proxy
  impl="$(jq -r --arg n "${IMPL_NAME}" \
    '.transactions[] | select(.transactionType=="CREATE" and .contractName==$n) | .contractAddress' \
    "${RUN}" | head -1)"
  if [[ -z "${impl}" || "${impl}" == "null" ]]; then
    echo "broadcast_erc1967_proxy_address: no CREATE for implementation ${IMPL_NAME} in ${RUN}" >&2
    return 1
  fi
  proxy="$(jq -r --arg impl "${impl}" \
    '.transactions[]
      | select(.transactionType=="CREATE" and .contractName=="ERC1967Proxy")
      | select((.arguments[0] // "") | ascii_downcase == ($impl | ascii_downcase))
      | .contractAddress' \
    "${RUN}" | head -1)"
  if [[ -z "${proxy}" || "${proxy}" == "null" ]]; then
    echo "broadcast_erc1967_proxy_address: no ERC1967Proxy for impl ${impl} (${IMPL_NAME}) in ${RUN}" >&2
    return 1
  fi
  echo "${proxy}"
}

broadcast_direct_create_address() {
  local RUN="$1"
  local NAME="$2"
  jq -r --arg n "${NAME}" \
    '.transactions[] | select(.transactionType=="CREATE" and .contractName==$n) | .contractAddress' \
    "${RUN}" | head -1
}
