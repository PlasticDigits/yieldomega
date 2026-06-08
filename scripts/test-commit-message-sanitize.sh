#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Regression tests for scripts/lib/sanitize_commit_message.py
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY="${ROOT}/scripts/lib/sanitize_commit_message.py"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

sanitize_file() {
  local infile="$1"
  INFILE="$infile" ROOT="$ROOT" python3 - <<'PY'
import os
import sys

sys.path.insert(0, os.path.join(os.environ["ROOT"], "scripts", "lib"))
from sanitize_commit_message import sanitize_commit_message

with open(os.environ["INFILE"], encoding="utf-8") as fh:
    msg = fh.read()
result = sanitize_commit_message(msg)
if result.subject_rejected:
    raise SystemExit(2)
sys.stdout.write(result.text)
PY
}

assert_ok() {
  local msg="$1"
  local expected="$2"
  local tmp expected_file got_file
  tmp="$(mktemp)"
  expected_file="$(mktemp)"
  got_file="$(mktemp)"
  printf '%s' "$msg" >"$tmp"
  printf '%s' "$expected" >"$expected_file"
  sanitize_file "$tmp" >"$got_file"
  cmp -s "$expected_file" "$got_file" || fail "sanitize mismatch for: $msg"
  rm -f "$tmp" "$expected_file" "$got_file"
}

assert_reject() {
  local msg="$1"
  local tmp rc=0
  tmp="$(mktemp)"
  printf '%s' "$msg" >"$tmp"
  sanitize_file "$tmp" >/dev/null 2>&1 || rc=$?
  rm -f "$tmp"
  [[ "$rc" -eq 2 ]] || fail "expected subject reject for: $msg (rc=$rc)"
}

assert_ok $'feat: add thing\n\nMore detail.\n' $'feat: add thing\n\nMore detail.\n'
assert_ok $'feat: add thing\n' $'feat: add thing\n'

assert_ok $'feat: add thing\n\nCo-authored-by: bot <bot@example.com>\n' $'feat: add thing\n'
assert_ok $'feat: add thing\n\nSee author guide\n' $'feat: add thing\n'
assert_ok $'feat: add thing\n\nContact team@corp.io for help\n' $'feat: add thing\n'
assert_ok $'feat: add thing\n\nCo-authored-by: Name Only\n\nKeep this.\n' $'feat: add thing\n\nKeep this.\n'
assert_ok $'feat: add thing\n\nauthored docs only\n' $'feat: add thing\n\nauthored docs only\n'

assert_reject $'fix: email user@example.com in subject\n'
assert_reject $'fix: author name in subject\n'

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
cat >"$tmp" <<'EOF'
feat: hook test

Co-authored-by: someone <a@b.co>
EOF
python3 "$PY" --file "$tmp" || fail "hook file mode failed"
grep -q 'Co-authored-by' "$tmp" && fail "file should be stripped"
grep -qxF 'feat: hook test' "$tmp" || fail "subject should remain"

echo "ok commit message sanitize tests"
