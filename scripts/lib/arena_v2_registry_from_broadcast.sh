#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Resolve Arena v2 contract addresses from a DeployProduction broadcast JSON.
#
# Requires `broadcast_proxy_addresses.sh` sourced first. Sets:
#   DOUB, CRED, PV (PodiumVaults), AV (AdminSellVault), RR, TA (TimeArena),
#   BUY_ROUTER (optional TimeArenaBuyRouter — empty when not deployed).
#
# GitLab #259.

yieldomega_zero_to_empty() {
  if [[ "${1:-}" == "0x0000000000000000000000000000000000000000" ]]; then
    echo ""
  else
    echo "${1:-}"
  fi
}

yieldomega_arena_v2_extract_registry_addresses() {
  local RUN="$1"
  if [[ -z "${RUN}" ]]; then
    echo "yieldomega_arena_v2_extract_registry_addresses: need RUN_JSON path." >&2
    return 1
  fi

  DOUB="$(broadcast_direct_create_address "${RUN}" Doubloon)"
  CRED="$(broadcast_direct_create_address "${RUN}" PlayCred)"
  PV="$(broadcast_direct_create_address "${RUN}" PodiumVaults)"
  AV="$(broadcast_direct_create_address "${RUN}" AdminSellVault)"
  RR="$(broadcast_erc1967_proxy_address "${RUN}" ReferralRegistry)"
  TA="$(broadcast_erc1967_proxy_address "${RUN}" TimeArena)"
  BUY_ROUTER="$(yieldomega_zero_to_empty "$(broadcast_direct_create_address "${RUN}" TimeArenaBuyRouter 2>/dev/null || true)")"

  for required in DOUB CRED PV AV RR TA; do
    if [[ -z "${!required:-}" ]]; then
      echo "Could not resolve ${required} from broadcast JSON: ${RUN}" >&2
      return 1
    fi
  done
}
