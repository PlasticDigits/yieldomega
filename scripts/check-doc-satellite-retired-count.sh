#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Fail if docs/ still contain too many retired v1 TimeCurve|FeeRouter tokens.
# GitLab #276 — complements scripts/check-doc-retired-terms.sh (P0 paths, #274)
# Usage (repo root): bash scripts/check-doc-satellite-retired-count.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PATTERN='TimeCurve|FeeRouter'
MAX_FILES=15
MAX_MENTIONS=25

file_count="$(rg -l "$PATTERN" docs/ 2>/dev/null | wc -l | tr -d ' ')"
mention_count="$(rg -o "$PATTERN" docs/ 2>/dev/null | wc -l | tr -d ' ')"

echo "[check-doc-satellite-retired-count] files=${file_count} (max ${MAX_FILES}) mentions=${mention_count} (max ${MAX_MENTIONS})"

if [[ "$file_count" -gt "$MAX_FILES" ]]; then
  echo "[check-doc-satellite-retired-count] too many files — trim docs/ per [#276](https://gitlab.com/PlasticDigits/yieldomega/-/issues/276):" >&2
  rg -c "$PATTERN" docs/ 2>/dev/null | sort -t: -k2 -nr >&2 || true
  exit 1
fi

if [[ "$mention_count" -gt "$MAX_MENTIONS" ]]; then
  echo "[check-doc-satellite-retired-count] too many tokens — rephrase or delete per [#276](https://gitlab.com/PlasticDigits/yieldomega/-/issues/276):" >&2
  rg -n "$PATTERN" docs/ 2>/dev/null | sort >&2 || true
  exit 1
fi

echo "[check-doc-satellite-retired-count] OK — satellite docs within #276 budget"
