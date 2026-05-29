#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Fail if markdown links to missing #anchors in docs/testing/invariants-and-business-logic.md
# Usage (repo root): bash scripts/check-doc-anchors.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INV="${ROOT}/docs/testing/invariants-and-business-logic.md"

if [[ ! -f "$INV" ]]; then
  echo "[check-doc-anchors] missing ${INV}" >&2
  exit 1
fi

mapfile -t ANCHORS < <(grep -oE '<a id="[^"]+"' "$INV" | sed -E 's/<a id="([^"]+)"/\1/' | sort -u)

missing=0
while IFS= read -r anchor; do
  [[ -z "$anchor" ]] && continue
  found=0
  for a in "${ANCHORS[@]}"; do
    if [[ "$a" == "$anchor" ]]; then
      found=1
      break
    fi
  done
  if [[ "$found" != 1 ]]; then
    echo "[check-doc-anchors] broken anchor: #${anchor}" >&2
    missing=$((missing + 1))
  fi
done < <(rg -o 'invariants-and-business-logic\.md#([a-z0-9-]+)' "$ROOT/docs" "$ROOT/skills" \
  --glob '*.md' \
  --no-filename \
  -r '$1' \
  2>/dev/null | sort -u || true)

if [[ "$missing" -gt 0 ]]; then
  echo "[check-doc-anchors] ${missing} broken anchor(s) (see above)" >&2
  exit 1
fi

echo "[check-doc-anchors] OK — ${#ANCHORS[@]} anchor(s), no broken links"
