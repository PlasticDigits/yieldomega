#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Copy trimmed album MP3s into frontend/public/music/albums/glass_arena/.
#
# Run only after BOTH parts finished generation and lead-in trim:
#   python trim_lead_in.py --dir output/album_part_1 --skip 0.15
#   python trim_lead_in.py --dir output/album_part_2 --skip 0.15
#   bash promote_album_to_public.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PART1="$ROOT/scripts/replicate-music/output/album_part_1"
PART2="$ROOT/scripts/replicate-music/output/album_part_2"
PUB="$ROOT/frontend/public/music/albums/glass_arena"

pick_source() {
  local base="$1"
  local dir="$2"
  if [[ -f "$dir/${base}_leadtrim.mp3" ]]; then
    echo "$dir/${base}_leadtrim.mp3"
  elif [[ -f "$dir/${base}.mp3" ]]; then
    echo "$dir/${base}.mp3"
  else
    echo "missing: $dir/${base}.mp3 (or _leadtrim)" >&2
    return 1
  fi
}

mkdir -p "$PUB"

part1_slugs=(
  01-console-boot
  02-doub-route
  03-pay-switch
  04-audit-hub
  05-podium-pulse
  06-last-buy
  07-streak-lock
  08-session-close
)

for slug in "${part1_slugs[@]}"; do
  src="$(pick_source "$slug" "$PART1")"
  cp "$src" "$PUB/${slug}.mp3"
  echo "[ok] $PUB/${slug}.mp3"
done

part2_slugs=(
  01-arena-gate
  02-warbow-scout
  03-prize-pulse
  04-indexer-sync
  05-warbow-scuffle
  06-charm-vault
  07-bridge-span
  08-logout-lullaby
)
idx=9
for slug in "${part2_slugs[@]}"; do
  tail="${slug#??-}"
  dest="$(printf '%02d' "$idx")-${tail}.mp3"
  src="$(pick_source "$slug" "$PART2")"
  cp "$src" "$PUB/$dest"
  echo "[ok] $PUB/$dest"
  idx=$((idx + 1))
done

echo "[done] promoted 16 tracks to $PUB"
