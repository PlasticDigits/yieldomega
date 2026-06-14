#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Emit abiHashesSha256 for address registry JSON (Stage 3 / mainnet consumers).
# Prereq: forge, jq. Run from repo root: contracts/script/export_abi_hashes.sh
# Arena v2 contract set — GitLab #259.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v forge >/dev/null 2>&1; then
  echo "forge not found; install Foundry." >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "jq not found." >&2
  exit 1
fi

# Registry-only tooling can set YIELDOMEGA_EXPORT_ABI_SKIP_FORGE_BUILD=1 to use existing `out/`
# artifacts without recompiling (requires a prior `forge build`).
if [[ "${YIELDOMEGA_EXPORT_ABI_SKIP_FORGE_BUILD:-0}" =~ ^(1|true|yes)$ ]]; then
  :
else
  forge build --quiet
fi

# Path: out/<SourceFile>.sol/<ContractName>.json
declare -a PAIRS=(
  "TimeArena.sol:TimeArena"
  "PodiumVaults.sol:PodiumVaults"
  "TimeArenaBuyRouter.sol:TimeArenaBuyRouter"
  "Doubloon.sol:Doubloon"
  "PlayCred.sol:PlayCred"
  "ReferralRegistry.sol:ReferralRegistry"
)

echo "  \"abiHashesSha256\": {"
first=1
for pair in "${PAIRS[@]}"; do
  file="${pair%%:*}"
  name="${pair##*:}"
  json="out/${file}/${name}.json"
  if [[ ! -f "$json" ]]; then
    echo "missing artifact: $json (run forge build)" >&2
    exit 1
  fi
  # SHA-256 of compact JSON encoding of the ABI array (stable for pinning).
  hash="$(jq -c '.abi' "$json" | sha256sum | awk '{print $1}')"
  if [[ "$first" -eq 1 ]]; then
    first=0
  else
    echo ","
  fi
  printf '    \"%s\": \"%s\"' "$name" "$hash"
done
echo ""
echo "  }"
