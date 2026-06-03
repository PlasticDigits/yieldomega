#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Fail on stale TimeCurve-era doc strings in satellite docs (GitLab #284).
# Complements check-doc-retired-terms.sh (#274) and check-doc-satellite-retired-count.sh (#276).
# Usage (repo root): bash scripts/check-doc-timecurve-satellite.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Forbidden: retired DOM/testid names or renamed markdown anchors still linked in docs/.
FORBIDDEN=(
  'timecurve-arena-buy-chain-write-gate'
  'arena-arena-buy-charm-cta'
  '#timecurve-podiums-http'
  '#timecurve-buy-wallet-session-drift-gitlab-144'
  '<a id="timecurve-'
)

hits=0
for needle in "${FORBIDDEN[@]}"; do
  if rg -q --fixed-strings "$needle" docs/ skills/ 2>/dev/null; then
    echo "[check-doc-timecurve-satellite] forbidden pattern: ${needle}" >&2
    rg -n --fixed-strings "$needle" docs/ skills/ 2>/dev/null | head -20 >&2 || true
    hits=$((hits + 1))
  fi
done

if [[ "$hits" -gt 0 ]]; then
  echo "[check-doc-timecurve-satellite] ${hits} pattern(s) failed — use Arena v2 vocabulary ([#284](https://gitlab.com/PlasticDigits/yieldomega/-/issues/284))" >&2
  exit 1
fi

echo "[check-doc-timecurve-satellite] OK — no stale timecurve satellite strings in docs/ or skills/"
