#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Fail if markdown links to missing #anchors in docs/testing/invariants-and-business-logic.md
# and docs/frontend/arena-views.md.
# Usage (repo root): bash scripts/check-doc-anchors.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

_check_anchors_in_file() {
  local target="$1"
  local link_pattern="$2"
  local label="$3"

  if [[ ! -f "${target}" ]]; then
    echo "[check-doc-anchors] missing ${target}" >&2
    return 1
  fi

  mapfile -t anchors < <(grep -oE '<a id="[^"]+"' "${target}" \
    | sed -E 's/<a id="([^"]+)"/\1/' | sort -u)

  local missing=0
  while IFS= read -r anchor; do
    [[ -z "${anchor}" ]] && continue
    local found=0
    for a in "${anchors[@]}"; do
      if [[ "${a}" == "${anchor}" ]]; then
        found=1
        break
      fi
    done
    if [[ "${found}" != 1 ]]; then
      echo "[check-doc-anchors] broken anchor in ${label}: #${anchor}" >&2
      missing=$((missing + 1))
    fi
  done < <(rg -o "${link_pattern}" "${ROOT}/docs" "${ROOT}/skills" \
    --glob '*.md' \
    --no-filename \
    -r '$1' \
    2>/dev/null | sort -u || true)

  if [[ "${missing}" -gt 0 ]]; then
    echo "[check-doc-anchors] ${missing} broken anchor(s) in ${label}" >&2
    return 1
  fi

  echo "[check-doc-anchors] ${label}: OK — ${#anchors[@]} anchor(s)"
  return 0
}

failed=0
_check_anchors_in_file \
  "${ROOT}/docs/testing/invariants-and-business-logic.md" \
  'invariants-and-business-logic\.md#([a-z0-9-]+)' \
  "invariants" || failed=1
_check_anchors_in_file \
  "${ROOT}/docs/frontend/arena-views.md" \
  'arena-views\.md#([a-z0-9-]+)' \
  "arena-views" || failed=1

if [[ "${failed}" -ne 0 ]]; then
  exit 1
fi

echo "[check-doc-anchors] OK — all tracked doc anchors resolve"
