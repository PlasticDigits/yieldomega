#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Fail if operator/agent-facing docs still cite retired v1 TimeCurve/FeeRouter paths.
# GitLab #274 — complements scripts/check-doc-anchors.sh
# Usage (repo root): bash scripts/check-doc-retired-terms.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PATTERN='VITE_FEE_ROUTER|FeeRouter\.distributeFees|TimeCurve\.endSale|redeemCharms|idx_timecurve'

# Operator / agent paths that must have zero matches (acceptance criteria #274)
TARGETS=(
  docs/qa/
  docs/testing/qa-local-full-stack.md
  docs/agent-phases.md
  docs/agent-implementation-phases.md
)

hits=0
for target in "${TARGETS[@]}"; do
  if [[ ! -e "$target" ]]; then
    echo "[check-doc-retired-terms] missing path: ${target}" >&2
    hits=$((hits + 1))
    continue
  fi
  if rg -q "$PATTERN" "$target" 2>/dev/null; then
    echo "[check-doc-retired-terms] retired v1 term(s) in ${target}:" >&2
    rg -n "$PATTERN" "$target" >&2 || true
    hits=$((hits + 1))
  fi
done

if [[ "$hits" -gt 0 ]]; then
  echo "[check-doc-retired-terms] ${hits} path(s) failed — remove retired TimeCurve/FeeRouter operator instructions ([#274](https://gitlab.com/PlasticDigits/yieldomega/-/issues/274))" >&2
  exit 1
fi

echo "[check-doc-retired-terms] OK — no retired v1 operator terms in P0 paths"
