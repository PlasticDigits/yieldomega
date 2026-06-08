#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Cloud Agent VM toolchain bootstrap (idempotent).
#
# Installs / configures system deps agents need every session:
#   - apt: libssl-dev, pkg-config, xvfb, Docker (fuse-overlayfs or vfs fallback)
#   - Foundry (foundryup → ~/.foundry/bin)
#   - Rust stable ≥ 1.85 (rustup)
#   - glab CLI + GITLAB_TOKEN auth + remote.origin_url for PlasticDigits/yieldomega
#   - dockerd when systemd cannot start it; socket permissions for the dev user
#
# Does NOT run npm ci (see bootstrap-dev.sh) or Playwright/Rabby wallet import (bootstrap-cloud-agent.sh).
# Installs unpacked Rabby extension (root) so Rabby smoke works even if agent bootstrap is skipped.
#
# Usage (repo root):
#   bash scripts/bootstrap-cloud-vm-toolchain.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"
# shellcheck source=scripts/lib/docker_cloud_agent.sh
source "${ROOT}/scripts/lib/docker_cloud_agent.sh"
# shellcheck source=scripts/lib/rabby_cloud_agent.sh
source "${ROOT}/scripts/lib/rabby_cloud_agent.sh"
# shellcheck source=scripts/lib/glab_cloud_agent.sh
source "${ROOT}/scripts/lib/glab_cloud_agent.sh"
# shellcheck source=scripts/lib/git_cloud_agent.sh
source "${ROOT}/scripts/lib/git_cloud_agent.sh"
# shellcheck source=scripts/lib/cloud_agent_path.sh
source "${ROOT}/scripts/lib/cloud_agent_path.sh"
MIN_RUST_VERSION="1.85.0"
DOCKER_DAEMON_JSON="/etc/docker/daemon.json"
DOCKERD_LOG="/tmp/yieldomega-dockerd.log"

log() {
  echo "==> $*"
}

need_sudo() {
  [[ "$(id -u)" -eq 0 ]] || command -v sudo >/dev/null 2>&1
}

run_as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

apt_packages_present() {
  dpkg-query -W -f='${Status}' "$1" 2>/dev/null | grep -q "install ok installed"
}

ensure_apt_packages() {
  local pkgs=()
  for pkg in libssl-dev pkg-config xvfb curl jq unzip iproute2; do
    apt_packages_present "${pkg}" || pkgs+=("${pkg}")
  done
  if [[ ${#pkgs[@]} -gt 0 ]] && need_sudo; then
    log "apt packages: ${pkgs[*]}"
    run_as_root apt-get update -qq
    run_as_root DEBIAN_FRONTEND=noninteractive apt-get install -y "${pkgs[@]}"
  fi
}

version_ge() {
  # usage: version_ge 1.96.0 1.85.0
  printf '%s\n%s\n' "$2" "$1" | sort -C -V
}

ensure_rust() {
  if ! command -v rustc >/dev/null 2>&1; then
    log "Rust missing — install rustup from https://rustup.rs/ on this image"
    return 1
  fi
  local ver
  ver="$(rustc --version | awk '{print $2}')"
  if version_ge "${ver}" "${MIN_RUST_VERSION}"; then
    log "Rust ${ver} (≥ ${MIN_RUST_VERSION})"
    return 0
  fi
  log "Upgrading Rust (${ver} < ${MIN_RUST_VERSION})"
  if command -v rustup >/dev/null 2>&1; then
    rustup update stable
    rustup default stable
  else
    echo "bootstrap-cloud-vm-toolchain: rustup not found; cannot upgrade Rust." >&2
    return 1
  fi
  log "Rust $(rustc --version | awk '{print $2}')"
}

ensure_foundry() {
  yieldomega_prepend_cloud_toolchain_path
  if command -v forge >/dev/null 2>&1 && command -v anvil >/dev/null 2>&1 && command -v cast >/dev/null 2>&1; then
    yieldomega_persist_cloud_toolchain_path
    log "Foundry $(forge --version | head -1)"
    return 0
  fi
  log "Installing Foundry (foundryup)"
  if [[ ! -x "${HOME}/.foundry/bin/foundryup" ]]; then
    curl -L https://foundry.paradigm.xyz | bash
  fi
  yieldomega_prepend_cloud_toolchain_path
  foundryup
  yieldomega_prepend_cloud_toolchain_path
  command -v forge >/dev/null 2>&1 || {
    echo "bootstrap-cloud-vm-toolchain: forge not on PATH after foundryup." >&2
    return 1
  }
  yieldomega_persist_cloud_toolchain_path
  log "Foundry $(forge --version | head -1)"
}

install_docker_packages() {
  if command -v docker >/dev/null 2>&1; then
    return 0
  fi
  if ! need_sudo; then
    echo "bootstrap-cloud-vm-toolchain: docker missing and no sudo." >&2
    return 1
  fi
  log "Installing Docker CE (fuse-overlayfs)"
  run_as_root install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
    curl --retry 3 --retry-delay 5 -fsSL https://download.docker.com/linux/ubuntu/gpg \
      | run_as_root gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    run_as_root chmod a+r /etc/apt/keyrings/docker.gpg
  fi
  if [[ ! -f /etc/apt/sources.list.d/docker.list ]]; then
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${VERSION_CODENAME}") stable" \
      | run_as_root tee /etc/apt/sources.list.d/docker.list >/dev/null
  fi
  run_as_root apt-get update -qq
  run_as_root DEBIAN_FRONTEND=noninteractive apt-get install -y \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin \
    fuse-overlayfs iptables
  run_as_root update-alternatives --set iptables /usr/sbin/iptables-legacy 2>/dev/null || true
  run_as_root update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy 2>/dev/null || true
}

write_docker_storage_driver() {
  local driver="$1"
  run_as_root mkdir -p /etc/docker
  printf '%s\n' '{' "  \"storage-driver\": \"${driver}\"" '}' \
    | run_as_root tee "${DOCKER_DAEMON_JSON}" >/dev/null
  log "Docker storage-driver: ${driver}"
}

docker_daemon_responds() {
  docker info >/dev/null 2>&1
}

docker_run_hello() {
  docker run --rm hello-world >/dev/null 2>&1
}

start_dockerd_if_needed() {
  if docker_daemon_responds; then
    return 0
  fi
  if ! command -v dockerd >/dev/null 2>&1; then
    return 1
  fi
  log "Starting dockerd (systemd unavailable on some Cloud VMs)"
  if pgrep -x dockerd >/dev/null 2>&1; then
    sleep 2
    docker_daemon_responds && return 0
  fi
  run_as_root nohup dockerd >"${DOCKERD_LOG}" 2>&1 &
  for _ in $(seq 1 30); do
    sleep 1
    docker_daemon_responds && return 0
  done
  echo "bootstrap-cloud-vm-toolchain: dockerd failed to start (see ${DOCKERD_LOG})." >&2
  return 1
}

ensure_docker() {
  install_docker_packages || true
  if ! command -v docker >/dev/null 2>&1; then
    echo "bootstrap-cloud-vm-toolchain: docker CLI not available — stack scripts need native Postgres (AGENTS.md)." >&2
    return 0
  fi

  if ! docker_daemon_responds; then
    write_docker_storage_driver "fuse-overlayfs"
    start_dockerd_if_needed || true
    yieldomega_fix_docker_socket_permissions || true
  else
    yieldomega_fix_docker_socket_permissions || true
  fi

  if docker_daemon_responds && ! docker_run_hello; then
    log "Docker hello-world failed with fuse-overlayfs — trying vfs storage driver"
    run_as_root pkill -x dockerd 2>/dev/null || true
    sleep 2
    write_docker_storage_driver "vfs"
    start_dockerd_if_needed || true
    yieldomega_fix_docker_socket_permissions || true
  fi

  if yieldomega_docker_usable_for_agent; then
    log "Docker OK ($(docker info --format '{{.Driver}}' 2>/dev/null || echo unknown)) — verified as ${USER:-agent}"
    yieldomega_clear_docker_unavailable
    return 0
  fi

  local kind
  kind="$(yieldomega_docker_error_kind)"
  if docker_daemon_responds; then
    yieldomega_fix_docker_socket_permissions || true
    if yieldomega_docker_usable_for_agent; then
      log "Docker OK after socket fix ($(docker info --format '{{.Driver}}' 2>/dev/null || echo unknown))"
      yieldomega_clear_docker_unavailable
      return 0
    fi
    yieldomega_mark_docker_unavailable "daemon_up_${kind}"
    yieldomega_docker_print_diagnosis
    echo "bootstrap-cloud-vm-toolchain: docker daemon up but agent user cannot run containers — use native Postgres (AGENTS.md)." >&2
  else
    yieldomega_mark_docker_unavailable "daemon_down_${kind}"
    yieldomega_docker_print_diagnosis
    echo "bootstrap-cloud-vm-toolchain: docker daemon not reachable — use native Postgres (AGENTS.md)." >&2
  fi
}

install_glab() {
  if yieldomega_glab_real_bin >/dev/null 2>&1; then
    log "glab $($(yieldomega_glab_real_bin) version 2>/dev/null | head -1 || true)"
    return 0
  fi
  log "Installing glab from GitLab releases"
  yieldomega_install_glab || {
    echo "bootstrap-cloud-vm-toolchain: glab install failed." >&2
    return 1
  }
  log "glab $($(yieldomega_glab_real_bin) version 2>/dev/null | head -1 || true)"
}

configure_glab() {
  if ! yieldomega_glab_real_bin >/dev/null 2>&1; then
    return 0
  fi
  local token repo
  yieldomega_persist_glab_env
  yieldomega_glab_export_token || true
  token="$(yieldomega_glab_token)"
  repo="$(yieldomega_glab_repo)"
  log "glab config: ${repo} (GITLAB_TOKEN + remote.origin_url)"
  yieldomega_configure_glab_auth
  yieldomega_persist_glab_env
  if [[ -n "${token}" ]]; then
    export GITLAB_TOKEN="${token}"
    export GLAB_TOKEN="${token}"
    export GITLAB_REPO="${repo}"
    if yieldomega_glab_api_ok; then
      log "GitLab API OK (${repo})"
    else
      echo "bootstrap-cloud-vm-toolchain: GITLAB_TOKEN did not pass GET /projects/${repo}." >&2
    fi
    if yieldomega_glab_repo_context_ok; then
      log "glab repo context OK"
    else
      echo "bootstrap-cloud-vm-toolchain: glab mr list failed — re-run bootstrap or check GITLAB_TOKEN." >&2
    fi
  else
    echo "bootstrap-cloud-vm-toolchain: GITLAB_TOKEN unset — set Cursor Cloud secret (PlasticDigits)." >&2
  fi
}

configure_git_identity() {
  if ! yieldomega_git_identity_env_ok; then
    echo "bootstrap-cloud-vm-toolchain: GIT_USERNAME and GIT_EMAIL unset — set Cursor Cloud secrets." >&2
    return 0
  fi
  log "git identity: ${GIT_USERNAME} <${GIT_EMAIL}>"
  yieldomega_configure_git_identity
}

verify_xvfb() {
  if ! command -v xvfb-run >/dev/null 2>&1; then
    echo "bootstrap-cloud-vm-toolchain: xvfb-run missing (needed for headless Rabby import)." >&2
    return 1
  fi
  xvfb-run -a bash -c 'echo xvfb-ok' >/dev/null
  log "xvfb-run OK"
}

yieldomega_prepend_cloud_toolchain_path
configure_git_identity
ensure_apt_packages
ensure_rust
ensure_foundry
ensure_docker
install_glab
configure_glab
yieldomega_persist_cloud_toolchain_path
verify_xvfb

ensure_rabby_extension() {
  if yieldomega_ensure_rabby_extension "${ROOT}"; then
    log "Rabby extension at ${YIELDOMEGA_RABBY_EXT_DIR}"
    return 0
  fi
  echo "bootstrap-cloud-vm-toolchain: Rabby extension install failed — Rabby smoke will not run." >&2
  echo "  Retry: sudo bash scripts/install-browser-extensions.sh" >&2
  return 1
}
ensure_rabby_extension || true

# Native Postgres for indexer QA when Docker yieldomega-pg is unavailable (GitLab #287).
if [[ -x "${ROOT}/scripts/bootstrap-cloud-postgres-native.sh" ]]; then
  bash "${ROOT}/scripts/bootstrap-cloud-postgres-native.sh" || {
    echo "bootstrap-cloud-vm-toolchain: native Postgres bootstrap failed (see above)." >&2
  }
fi

log "Cloud VM toolchain bootstrap finished."
if ! yieldomega_docker_usable_for_agent; then
  log "Docker: SKIP for agent user — bash scripts/verify-docker-cloud-agent.sh (native Postgres: AGENTS.md)"
else
  log "Docker: PASS for agent user"
fi
log "Next: bash scripts/bootstrap-cloud-agent.sh  (Playwright Chromium + Rabby + dev wallets)"
log "Postgres smoke: bash scripts/verify-cloud-postgres.sh"
log "Post-bootstrap smoke: bash scripts/verify-cloud-vm-toolchain.sh"
