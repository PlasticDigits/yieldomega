#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Fail when new legacy `timecurve-*` CSS classes, data-testids, or public art paths
# appear under frontend/src (GitLab #280). Route redirects and onchain revert strings
# are allowlisted.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ALLOWLIST=(
  "frontend/src/lib/revertMessage.ts"
  "frontend/src/app/LaunchGate.tsx"
  "frontend/src/lib/referralPathReserved.ts"
  "frontend/src/lib/referralPathCapture.ts"
  "frontend/src/pages/referrals/ReferralRegisterSection.tsx"
)

is_allowlisted() {
  local path="$1"
  for allowed in "${ALLOWLIST[@]}"; do
    if [[ "$path" == "$allowed" ]]; then
      return 0
    fi
  done
  return 1
}

fail=0
while IFS= read -r -d '' file; do
  rel="${file#"$ROOT"/}"
  if is_allowlisted "$rel"; then
    continue
  fi
  if rg -n 'timecurve-' "$file" >/tmp/check-arena-naming-hits.txt 2>/dev/null; then
    echo "[check-arena-naming] forbidden timecurve-* in ${rel}:" >&2
    sed 's/^/  /' /tmp/check-arena-naming-hits.txt >&2
    fail=1
  fi
done < <(find frontend/src -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \) -print0)

if [[ "$fail" -ne 0 ]]; then
  echo "[check-arena-naming] See GitLab #280 and INV-FRONTEND-280-ARENA-CSS-NAMING." >&2
  exit 1
fi

if rg -n 'timecurve-' frontend/src/pages/arena >/dev/null 2>&1; then
  echo "[check-arena-naming] frontend/src/pages/arena must not contain timecurve-*." >&2
  exit 1
fi

echo "[check-arena-naming] OK — no legacy timecurve-* identifiers in frontend/src (allowlist applied)."
