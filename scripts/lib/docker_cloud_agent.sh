# SPDX-License-Identifier: AGPL-3.0-only
# Cloud Agent Docker helpers (GitLab #288).
# Source from bootstrap / verify / stack scripts — do not execute directly.
#
# Invariants:
#   INV-DEVOPS-288-DOCKER-USER — docker info + hello-world without sudo as $USER, or marker + SKIP.
#   INV-DEVOPS-288-DIAGNOSE    — permission-denied vs overlay errors surfaced with remediation.
#
# See AGENTS.md § Docker troubleshooting (GitLab #288).

: "${YIELDOMEGA_DOCKER_UNAVAILABLE_MARKER:=/tmp/yieldomega-docker-unavailable}"
: "${YIELDOMEGA_DOCKER_SOCK:=/var/run/docker.sock}"

yieldomega_docker_log() {
  echo "docker-cloud-agent: $*"
}

yieldomega_docker_log_err() {
  echo "docker-cloud-agent: $*" >&2
}

yieldomega_native_postgres_oneliner() {
  cat <<'EOF'
Native Postgres (no Docker): see AGENTS.md § Postgres without Docker — port 5433, user yieldomega, DB yieldomega_indexer; or bash scripts/verify-podium-live-anvil.sh (host psql + own Anvil).
EOF
}

yieldomega_mark_docker_unavailable() {
  local reason="${1:-unknown}"
  printf '%s\n' "${reason}" >"${YIELDOMEGA_DOCKER_UNAVAILABLE_MARKER}"
  yieldomega_docker_log_err "Docker unavailable for agent user (${reason})."
  yieldomega_native_postgres_oneliner >&2
}

yieldomega_clear_docker_unavailable() {
  rm -f "${YIELDOMEGA_DOCKER_UNAVAILABLE_MARKER}"
}

yieldomega_docker_unavailable_marker_present() {
  [[ -f "${YIELDOMEGA_DOCKER_UNAVAILABLE_MARKER}" ]]
}

yieldomega_docker_socket_mode() {
  if [[ ! -e "${YIELDOMEGA_DOCKER_SOCK}" ]]; then
    echo "missing"
    return 0
  fi
  if command -v stat >/dev/null 2>&1; then
    stat -c '%a %U:%G' "${YIELDOMEGA_DOCKER_SOCK}" 2>/dev/null \
      || sudo stat -c '%a %U:%G' "${YIELDOMEGA_DOCKER_SOCK}" 2>/dev/null \
      || echo "stat-denied"
  else
    ls -l "${YIELDOMEGA_DOCKER_SOCK}" 2>/dev/null | awk '{print $1, $3, $4}' || echo "ls-denied"
  fi
}

# Prints multi-line diagnosis to stderr.
yieldomega_docker_print_diagnosis() {
  yieldomega_docker_log_err "--- Docker diagnosis (GitLab #288) ---"
  yieldomega_docker_log_err "USER=${USER:-?} uid=$(id -u 2>/dev/null || echo ?)"
  yieldomega_docker_log_err "groups: $(groups 2>/dev/null || id -Gn 2>/dev/null || echo unknown)"
  yieldomega_docker_log_err "docker.sock: $(yieldomega_docker_socket_mode) (${YIELDOMEGA_DOCKER_SOCK})"
  if command -v docker >/dev/null 2>&1; then
    yieldomega_docker_log_err "docker info (as ${USER:-?}):"
    docker info 2>&1 | sed 's/^/  /' >&2 || true
    yieldomega_docker_log_err "docker run hello-world (as ${USER:-?}):"
    docker run --rm hello-world 2>&1 | sed 's/^/  /' >&2 || true
  else
    yieldomega_docker_log_err "docker CLI not on PATH"
  fi
  if yieldomega_docker_unavailable_marker_present; then
    yieldomega_docker_log_err "marker: ${YIELDOMEGA_DOCKER_UNAVAILABLE_MARKER} ($(head -1 "${YIELDOMEGA_DOCKER_UNAVAILABLE_MARKER}" 2>/dev/null || echo empty))"
  fi
  yieldomega_docker_log_err "--- remediation ---"
  yieldomega_docker_log_err "1. Re-run: bash scripts/bootstrap-cloud-vm-toolchain.sh"
  yieldomega_docker_log_err "2. Or: sudo usermod -aG docker \"\${USER}\" && sudo chmod 666 ${YIELDOMEGA_DOCKER_SOCK}"
  yieldomega_docker_log_err "   (group change needs new shell; chmod 666 is immediate on most VMs)"
  yieldomega_docker_log_err "3. If nested VM blocks the socket: use native Postgres (AGENTS.md) — do not block Foundry-only tasks on Docker"
  yieldomega_docker_log_err "4. Verify: bash scripts/verify-docker-cloud-agent.sh"
  yieldomega_docker_log_err "-----------------------------------"
}

# Classify last docker CLI failure: permission_denied | overlay | daemon_down | cli_missing | ok
yieldomega_docker_error_kind() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "cli_missing"
    return 0
  fi
  local info_err run_err
  info_err="$(docker info 2>&1 >/dev/null || true)"
  if [[ -z "${info_err}" ]]; then
    run_err="$(docker run --rm hello-world 2>&1 >/dev/null || true)"
    if [[ -z "${run_err}" ]]; then
      echo "ok"
      return 0
    fi
    if echo "${run_err}" | grep -qiE 'permission denied.*docker\.sock|connect: permission denied'; then
      echo "permission_denied"
      return 0
    fi
    if echo "${run_err}" | grep -qiE 'overlay|fuse-overlayfs|failed to mount|storage-driver'; then
      echo "overlay"
      return 0
    fi
    echo "run_failed"
    return 0
  fi
  if echo "${info_err}" | grep -qiE 'permission denied.*docker\.sock|connect: permission denied'; then
    echo "permission_denied"
    return 0
  fi
  if echo "${info_err}" | grep -qiE 'Cannot connect to the Docker daemon|Is the docker daemon running'; then
    echo "daemon_down"
    return 0
  fi
  if echo "${info_err}" | grep -qiE 'overlay|fuse-overlayfs|failed to mount'; then
    echo "overlay"
    return 0
  fi
  echo "info_failed"
}

# Apply group + socket permissions (needs sudo). Returns 0 when agent user can docker info.
yieldomega_fix_docker_socket_permissions() {
  if [[ ! -S "${YIELDOMEGA_DOCKER_SOCK}" ]] && [[ ! -e "${YIELDOMEGA_DOCKER_SOCK}" ]]; then
    return 1
  fi
  if docker info >/dev/null 2>&1 && docker run --rm hello-world >/dev/null 2>&1; then
    yieldomega_clear_docker_unavailable
    return 0
  fi
  local run_as_root
  run_as_root() {
    if [[ "$(id -u)" -eq 0 ]]; then
      "$@"
    elif command -v sudo >/dev/null 2>&1; then
      sudo "$@"
    else
      return 1
    fi
  }
  if getent group docker >/dev/null 2>&1 && [[ -n "${USER:-}" ]]; then
    run_as_root usermod -aG docker "${USER}" 2>/dev/null || true
  fi
  run_as_root chmod 666 "${YIELDOMEGA_DOCKER_SOCK}" 2>/dev/null || true
  if docker info >/dev/null 2>&1 && docker run --rm hello-world >/dev/null 2>&1; then
    yieldomega_clear_docker_unavailable
    return 0
  fi
  # Secondary group may not be active in this shell; sg docker is a one-shot probe (do not hang).
  if getent group docker >/dev/null 2>&1 && command -v sg >/dev/null 2>&1; then
    if timeout 15 sg docker -c 'docker info >/dev/null && docker run --rm hello-world >/dev/null' 2>/dev/null; then
      yieldomega_docker_log "Docker works via 'sg docker' but not in this shell — open a new shell or rely on chmod 666."
      yieldomega_clear_docker_unavailable
      return 0
    fi
  fi
  return 1
}

# True when current user can docker info and docker run hello-world (no sudo).
yieldomega_docker_usable_for_agent() {
  command -v docker >/dev/null 2>&1 || return 1
  docker info >/dev/null 2>&1 || return 1
  docker run --rm hello-world >/dev/null 2>&1
}

# Human hint for stack scripts when docker fails.
yieldomega_docker_stack_failure_hint() {
  local kind
  kind="$(yieldomega_docker_error_kind)"
  case "${kind}" in
    permission_denied)
      echo "Docker API permission denied on ${YIELDOMEGA_DOCKER_SOCK} (user=${USER:-?}, groups=$(groups 2>/dev/null | tr ' ' ','))."
      echo "  Fix: bash scripts/bootstrap-cloud-vm-toolchain.sh  OR  bash scripts/verify-docker-cloud-agent.sh"
      echo "  Skip Docker stack: install native Postgres on port ${PG_HOST_PORT:-5433} — AGENTS.md § Postgres without Docker (#288)."
      ;;
    overlay)
      echo "Docker storage/overlay error on this nested VM — bootstrap retries vfs; see ${DOCKERD_LOG:-/tmp/yieldomega-dockerd.log}."
      echo "  Use native Postgres (AGENTS.md) for indexer verify scripts without yieldomega-pg."
      ;;
    cli_missing)
      echo "Docker CLI not installed — use native Postgres (AGENTS.md § Postgres without Docker)."
      ;;
    daemon_down)
      echo "Docker daemon not running — bash scripts/bootstrap-cloud-vm-toolchain.sh  OR  native Postgres fallback."
      ;;
    *)
      echo "Docker unavailable (kind=${kind}) — see bash scripts/verify-docker-cloud-agent.sh and AGENTS.md § Docker troubleshooting (#288)."
      ;;
  esac
}
