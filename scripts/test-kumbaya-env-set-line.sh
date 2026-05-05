#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Regression tests for scripts/lib/kumbaya_env_set_line.py + kumbaya_local_anvil_env.sh (GitLab #154).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/lib/kumbaya_local_anvil_env.sh
source "${ROOT}/scripts/lib/kumbaya_local_anvil_env.sh"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

# Replace path — adversarial value with &, #, backslash
cat >"$tmp" <<'EOF'
OTHER=1
VITE_TEST=old
EOF
_yieldomega_env_set_line "$tmp" "VITE_TEST" '0xabc&def#ghi\x/path'
grep -qxF 'VITE_TEST=0xabc&def#ghi\x/path' "$tmp" || fail "replace literal mismatch"

# Append path — marker injected then key
rm -f "$tmp"
echo "FOO=bar" >"$tmp"
_yieldomega_env_set_line "$tmp" "VITE_NEW" 'x&y#z'
grep -qxF 'FOO=bar' "$tmp" || fail "append kept prefix"
grep -qxF "${_yieldomega_env_kumbaya_marker}" "$tmp" || fail "marker missing"
grep -qxF 'VITE_NEW=x&y#z' "$tmp" || fail "append literal mismatch"

# Multiple ^KEY= lines — each replaced with the same literal (parity with legacy sed)
cat >"$tmp" <<'EOF'
VITE_DUP=a
VITE_DUP=b
EOF
_yieldomega_env_set_line "$tmp" "VITE_DUP" 'unified'
c="$(grep -c '^VITE_DUP=' "$tmp" || true)"
[[ "$c" -eq 2 ]] || fail "expected two VITE_DUP lines"
u="$(grep -c '^VITE_DUP=unified$' "$tmp" || true)"
[[ "$u" -eq 2 ]] || fail "both lines unified"

echo "ok kumbaya_env_set_line tests"
