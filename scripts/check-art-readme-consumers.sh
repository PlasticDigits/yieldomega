#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Fail when frontend/public/art/README.md links to retired TimeCurve consumers or
# missing ../../src/*.tsx paths (GitLab #286).
# Usage (repo root): bash scripts/check-art-readme-consumers.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
README="${ROOT}/frontend/public/art/README.md"

if [[ ! -f "$README" ]]; then
  echo "[check-art-readme-consumers] missing ${README}" >&2
  exit 1
fi

fail=0

if rg -n 'TimeCurvePage|TimeCurveArenaView|TimeCurveBranchPage|pages/ArenaSimplePage\.tsx' "$README" >/tmp/check-art-readme-stale.txt 2>/dev/null; then
  echo "[check-art-readme-consumers] stale TimeCurve or wrong ArenaSimplePage paths:" >&2
  sed 's/^/  /' /tmp/check-art-readme-stale.txt >&2
  fail=1
fi

while IFS= read -r rel; do
  [[ -z "$rel" ]] && continue
  path="${ROOT}/frontend/public/art/${rel}"
  if [[ ! -f "$path" ]]; then
    echo "[check-art-readme-consumers] broken consumer link: ${rel}" >&2
    fail=1
  fi
done < <(rg -o '\(\.\./\.\./src/[^)]+\)' "$README" | sed 's/[()]//g' | sort -u)

if [[ "$fail" -ne 0 ]]; then
  echo "[check-art-readme-consumers] See GitLab #286 and INV-FRONTEND-286-ART-README." >&2
  exit 1
fi

linked_count="$(rg -o '\(\.\./\.\./src/[^)]+\)' "$README" | sed 's/[()]//g' | sort -u | wc -l | tr -d ' ')"
echo "[check-art-readme-consumers] OK — ${linked_count} consumer .tsx/.ts path(s), no stale TimeCurve links."
