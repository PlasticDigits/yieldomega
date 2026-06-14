#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Fail if markdown links to missing #anchors in tracked docs.
# Usage (repo root): bash scripts/check-doc-anchors.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

check_anchors_in_file() {
  local doc_path="$1"
  local label="$2"
  local -n anchors_ref="$3"

  if [[ ! -f "${doc_path}" ]]; then
    echo "[check-doc-anchors] missing ${doc_path}" >&2
    return 1
  fi

  mapfile -t anchors_ref < <(grep -oE '<a id="[^"]+"' "${doc_path}" | sed -E 's/<a id="([^"]+)"/\1/' | sort -u)
  local missing=0
  local rel="${doc_path#${ROOT}/}"
  while IFS= read -r anchor; do
    [[ -z "$anchor" ]] && continue
    local found=0
    for a in "${anchors_ref[@]}"; do
      if [[ "$a" == "$anchor" ]]; then
        found=1
        break
      fi
    done
    if [[ "$found" != 1 ]]; then
      echo "[check-doc-anchors] broken anchor in ${label}: #${anchor} (from ${rel}#${anchor})" >&2
      missing=$((missing + 1))
    fi
  done < <(rg -o "${rel//\//\\/}#([a-z0-9-]+)" "$ROOT/docs" "$ROOT/skills" \
    --glob '*.md' \
    --no-filename \
    -r '$1' \
    2>/dev/null | sort -u || true)

  if [[ "$missing" -gt 0 ]]; then
    echo "[check-doc-anchors] ${missing} broken anchor(s) in ${label}" >&2
    return 1
  fi
  echo "[check-doc-anchors] OK — ${label}: ${#anchors_ref[@]} anchor(s), no broken links"
}

INV_ANCHORS=()
ARENA_ANCHORS=()
status=0

check_anchors_in_file "${ROOT}/docs/testing/invariants-and-business-logic.md" "invariants" INV_ANCHORS || status=1
check_anchors_in_file "${ROOT}/docs/frontend/arena-views.md" "arena-views" ARENA_ANCHORS || status=1

exit "${status}"
