#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Cloud Agent VM toolchain bootstrap (idempotent).
#
# Installs / configures system deps agents need every session:
#   - apt: libssl-dev, pkg-config, xvfb, Docker (fuse-overlayfs or vfs fallback)
#   - Foundry (foundryup → ~/.foundry/bin)
#   - Rust stable ≥ 1.85 (rustup)
#   - glab CLI + GITLAB_TOKEN auth + remote_alias for PlasticDigits/yieldomega
#   - dockerd when systemd cannot start it; socket permissions for the dev user
#
# Does NOT run npm ci (see bootstrap-dev.sh) or Playwright/Rabby (bootstrap-cloud-agent.sh).
#
# Usage (repo root):
#   bash scripts/bootstrap-cloud-vm-toolchain.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"
# shellcheck source=scripts/lib/docker_cloud_agent.sh
source "${ROOT}/scripts/lib/docker_cloud_agent.sh"

YIELDOMEGA_GITLAB_HOST="${YIELDOMEGA_GITLAB_HOST:-gitlab.com}"
YIELDOMEGA_GITLAB_PROJECT="${YIELDOMEGA_GITLAB_PROJECT:-PlasticDigits/yieldomega}"
# glab ≥1.100 uses `remote_alias` (git remote name) and optional GITLAB_REPO — not remote.origin_url.
YIELDOMEGA_GITLAB_GLAB_REPO="${YIELDOMEGA_GITLAB_GLAB_REPO:-${YIELDOMEGA_GITLAB_PROJECT}}"
YIELDOMEGA_GITLAB_REMOTE="${YIELDOMEGA_GITLAB_REMOTE:-origin}"
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
  export PATH="${HOME}/.foundry/bin:${PATH}"
  if command -v forge >/dev/null 2>&1 && command -v anvil >/dev/null 2>&1 && command -v cast >/dev/null 2>&1; then
    log "Foundry $(forge --version | head -1)"
    return 0
  fi
  log "Installing Foundry (foundryup)"
  if [[ ! -x "${HOME}/.foundry/bin/foundryup" ]]; then
    curl -L https://foundry.paradigm.xyz | bash
  fi
  export PATH="${HOME}/.foundry/bin:${PATH}"
  foundryup
  command -v forge >/dev/null 2>&1 || {
    echo "bootstrap-cloud-vm-toolchain: forge not on PATH after foundryup." >&2
    return 1
  }
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
  if command -v glab >/dev/null 2>&1; then
    log "glab $(glab version 2>/dev/null | head -1 || true)"
    return 0
  fi
  if ! need_sudo; then
    echo "bootstrap-cloud-vm-toolchain: glab missing and no sudo to install." >&2
    return 1
  fi
  log "Installing glab from GitLab releases"
  local arch deb tmp
  arch="$(dpkg --print-architecture)"
  tmp="$(mktemp -d)"
  trap 'rm -rf "${tmp}"' RETURN
  deb="$(curl -fsSL "https://gitlab.com/api/v4/projects/gitlab-org%2Fcli/releases" \
    | jq -r '.[0].assets.links[] | select(.name | test("\\.deb$")) | select(.name | contains("'"${arch}"'")) | .direct_asset_url' \
    | head -1)"
  if [[ -z "${deb}" || "${deb}" == "null" ]]; then
    deb="$(curl -fsSL "https://gitlab.com/api/v4/projects/gitlab-org%2Fcli/releases" \
      | jq -r '.[0].assets.links[] | select(.name | test("glab_.*linux_amd64\\.deb$")) | .direct_asset_url' \
      | head -1)"
  fi
  [[ -n "${deb}" && "${deb}" != "null" ]] || {
    echo "bootstrap-cloud-vm-toolchain: could not resolve glab .deb URL." >&2
    return 1
  }
  curl -fsSL -o "${tmp}/glab.deb" "${deb}"
  run_as_root DEBIAN_FRONTEND=noninteractive apt-get install -y "${tmp}/glab.deb"
  log "glab $(glab version 2>/dev/null | head -1 || true)"
}

configure_glab() {
  if ! command -v glab >/dev/null 2>&1; then
    return 0
  fi
  local token="${GITLAB_TOKEN:-${GLAB_TOKEN:-}}"
  log "glab config: remote_alias=${YIELDOMEGA_GITLAB_REMOTE} (repo ${YIELDOMEGA_GITLAB_GLAB_REPO})"
  glab config set --global remote_alias "${YIELDOMEGA_GITLAB_REMOTE}" 2>/dev/null \
    || glab config set remote_alias "${YIELDOMEGA_GITLAB_REMOTE}" 2>/dev/null \
    || true
  glab config set --global host "${YIELDOMEGA_GITLAB_HOST}" 2>/dev/null || true
  # Cloud clones use HTTPS + GITLAB_TOKEN; default ssh git_protocol breaks glab repo/MR resolution.
  glab config set --global git_protocol https 2>/dev/null || true
  if git -C "${ROOT}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    glab config set remote_alias "${YIELDOMEGA_GITLAB_REMOTE}" 2>/dev/null || true
    if ! git -C "${ROOT}" remote get-url "${YIELDOMEGA_GITLAB_REMOTE}" >/dev/null 2>&1; then
      if [[ -n "${token}" ]]; then
        glab repo remote add "${YIELDOMEGA_GITLAB_GLAB_REPO}" \
          --remote "${YIELDOMEGA_GITLAB_REMOTE}" 2>/dev/null || true
      fi
    fi
  fi
  if [[ -n "${token}" ]]; then
    export GITLAB_TOKEN="${token}"
    export GLAB_TOKEN="${token}"
    glab auth login --hostname "${YIELDOMEGA_GITLAB_HOST}" --token "${token}" 2>/dev/null \
      || glab auth status 2>/dev/null || true
    # Smoke: same project lookup agents use for MR/issue workflows.
    if curl -fsS -H "PRIVATE-TOKEN: ${token}" \
      "https://${YIELDOMEGA_GITLAB_HOST}/api/v4/projects/${YIELDOMEGA_GITLAB_PROJECT//\//%2F}" \
      >/dev/null; then
      log "GitLab API token OK for ${YIELDOMEGA_GITLAB_PROJECT}"
    else
      echo "bootstrap-cloud-vm-toolchain: GITLAB_TOKEN did not pass GET /projects/${YIELDOMEGA_GITLAB_PROJECT}." >&2
    fi
    if git -C "${ROOT}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      if glab mr list --per-page 1 >/dev/null 2>&1; then
        log "glab repo context OK (git remote ${YIELDOMEGA_GITLAB_REMOTE})"
      else
        echo "bootstrap-cloud-vm-toolchain: glab mr list failed — check git remote and GITLAB_TOKEN." >&2
      fi
    fi
  else
    echo "bootstrap-cloud-vm-toolchain: GITLAB_TOKEN unset — glab remote_alias configured; set token for API/MR commands." >&2
  fi
}

verify_xvfb() {
  if ! command -v xvfb-run >/dev/null 2>&1; then
    echo "bootstrap-cloud-vm-toolchain: xvfb-run missing (needed for headless Rabby import)." >&2
    return 1
  fi
  xvfb-run -a bash -c 'echo xvfb-ok' >/dev/null
  log "xvfb-run OK"
}

ensure_apt_packages
ensure_rust
ensure_foundry
ensure_docker
install_glab
configure_glab
verify_xvfb

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
