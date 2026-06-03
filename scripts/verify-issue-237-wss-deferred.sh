#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# GitLab #237 — Phase 1 MegaETH miniBlocks WSS is not shipped; verify deferral + RPC path intact.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="${HOME}/.foundry/bin:${PATH}"

die() {
  echo "verify-issue-237-wss-deferred: $*" >&2
  exit 1
}

log() {
  echo "verify-issue-237-wss-deferred: $*"
}

log "assert no WSS / miniBlocks implementation in indexer crate"
if rg -q 'miniBlocks|mini_blocks|INDEXER_WSS|eth_subscribe' "${ROOT}/indexer/src" 2>/dev/null; then
  die "unexpected WSS symbols under indexer/src (Phase 1 not merged or script stale)"
fi

log "assert no /v1/realtime routes in HTTP router"
if rg -q '/v1/realtime' "${ROOT}/indexer/src" 2>/dev/null; then
  die "found /v1/realtime routes — update this script when #237 Phase 1 lands"
fi

log "assert GET /v1/status does not overload max_indexed_block with WSS head"
if rg -q 'wss_realtime|mini_block' "${ROOT}/indexer/src/api.rs" 2>/dev/null; then
  die "status handler exposes WSS fields — update verification for shipped #237"
fi

log "assert frontend agent card has indexed block pill only (no WSS pill yet)"
if rg -q 'websockets block|mini-block|miniBlock|WssHead|data-testid=.indexer-wss' "${ROOT}/frontend/src" 2>/dev/null; then
  die "frontend WSS head UI present — update this script when #237 Phase 1 lands"
fi

log "indexer unit + integration tests (RPC ingest unchanged)"
unset DATABASE_POOL_MAX
if ! (cd "${ROOT}/indexer" && cargo test -q); then
  die "cargo test failed"
fi

log "PASS — #237 Phase 1 deferred; RPC ingestion tests green; no WSS/realtime surfaces"
