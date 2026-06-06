#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Portable TCP listen checks for stack scripts (Anvil/indexer port pick).
# Prefers `ss` (iproute2); falls back to netstat or a Python bind probe.

# yieldomega_tcp_port_listening PORT
# Exit 0 when something is listening on 127.0.0.1:PORT (or any local address).
yieldomega_tcp_port_listening() {
  local port="$1"
  [[ "${port}" =~ ^[0-9]+$ ]] || return 2

  if command -v ss >/dev/null 2>&1; then
    ss -tlnH "sport = :${port}" 2>/dev/null | grep -q .
    return $?
  fi

  if command -v netstat >/dev/null 2>&1; then
    netstat -tln 2>/dev/null | grep -qE ":${port}[[:space:]]"
    return $?
  fi

  python3 - "${port}" <<'PY'
import socket
import sys

port = int(sys.argv[1])
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
try:
    s.bind(("127.0.0.1", port))
except OSError:
    sys.exit(0)  # in use
finally:
    s.close()
sys.exit(1)  # free
PY
}
