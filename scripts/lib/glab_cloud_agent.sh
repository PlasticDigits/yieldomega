# SPDX-License-Identifier: AGPL-3.0-only
# Cloud Agent GitLab (glab) helpers for PlasticDigits/yieldomega.
# Source from bootstrap / verify scripts — do not execute directly.
#
# Cursor Cloud clones use x-access-token HTTPS remotes; bootstrap sets a clean
# remote.origin_url and GITLAB_REPO so glab works without GitLab MCP.

: "${YIELDOMEGA_GITLAB_HOST:=gitlab.com}"
: "${YIELDOMEGA_GITLAB_PROJECT:=PlasticDigits/yieldomega}"
: "${YIELDOMEGA_GITLAB_REMOTE:=origin}"
: "${YIELDOMEGA_CLOUD_AGENT_ENV:=${HOME}/.config/yieldomega/cloud-agent.env}"

# Load GITLAB_TOKEN from persisted bootstrap env when the shell secret is missing.
yieldomega_glab_load_persisted_token() {
  if [[ -n "${GITLAB_TOKEN:-}" || -n "${GLAB_TOKEN:-}" ]]; then
    return 0
  fi
  if [[ -f "${YIELDOMEGA_CLOUD_AGENT_ENV}" ]]; then
    # shellcheck source=/dev/null
    source "${YIELDOMEGA_CLOUD_AGENT_ENV}"
  fi
}

# Export GITLAB_TOKEN + GLAB_TOKEN for every glab invocation (required on Cloud VMs).
yieldomega_glab_export_token() {
  yieldomega_glab_load_persisted_token
  local token
  token="$(yieldomega_glab_token)"
  if [[ -z "${token}" ]]; then
    echo "yieldomega_glab: GITLAB_TOKEN unset — set Cursor Cloud secret (PlasticDigits)." >&2
    return 1
  fi
  export GITLAB_TOKEN="${token}"
  export GLAB_TOKEN="${token}"
}

# Strip trailing slashes and a .git suffix (x-access-token remotes confuse glab mr create).
yieldomega_glab_normalize_repo() {
  local repo="${1:-}"
  repo="${repo%/}"
  repo="${repo%.git}"
  echo "${repo}"
}

yieldomega_glab_repo() {
  yieldomega_glab_normalize_repo "${GITLAB_REPO:-${YIELDOMEGA_GITLAB_PROJECT}}"
}

yieldomega_glab_token() {
  yieldomega_glab_load_persisted_token
  echo "${GITLAB_TOKEN:-${GLAB_TOKEN:-}}"
}

# Credential-free project URL for glab (x-access-token remotes break repo auto-detect).
yieldomega_glab_remote_origin_url() {
  local repo
  repo="$(yieldomega_glab_repo)"
  echo "https://${YIELDOMEGA_GITLAB_HOST}/${repo}"
}

# Export token + repo env and invoke glab with explicit -R (PlasticDigits account).
yieldomega_glab() {
  local token repo glab_bin
  yieldomega_glab_export_token
  token="$(yieldomega_glab_token)"
  repo="$(yieldomega_glab_repo)"
  export GITLAB_REPO="${repo}"
  glab_bin="$(yieldomega_glab_real_bin)"
  GLAB_TOKEN="${token}" GITLAB_TOKEN="${token}" "${glab_bin}" -R "${repo}" "$@"
}

# Resolve the system glab binary (not scripts/bin/glab wrapper).
yieldomega_glab_real_bin() {
  local path entry
  for path in /usr/bin/glab /usr/local/bin/glab "${HOME}/.local/bin/glab-real"; do
    if [[ -x "${path}" ]]; then
      echo "${path}"
      return 0
    fi
  done
  IFS=':' read -r -a _path_parts <<<"${PATH}"
  for entry in "${_path_parts[@]}"; do
    [[ "${entry}" == *"/scripts/bin" ]] && continue
    if [[ -x "${entry}/glab" && "${entry}/glab" != "${BASH_SOURCE[0]:-}" ]]; then
      echo "${entry}/glab"
      return 0
    fi
  done
  command -v glab
}

yieldomega_configure_glab_auth() {
  local token repo clean_url glab_bin
  yieldomega_glab_export_token || true
  token="$(yieldomega_glab_token)"
  repo="$(yieldomega_glab_repo)"
  clean_url="$(yieldomega_glab_remote_origin_url)"
  glab_bin="$(yieldomega_glab_real_bin 2>/dev/null || true)"
  [[ -n "${glab_bin}" && -x "${glab_bin}" ]] || return 0
  GLAB_TOKEN="${token}" GITLAB_TOKEN="${token}" "${glab_bin}" config set --global host "${YIELDOMEGA_GITLAB_HOST}" 2>/dev/null || true
  GLAB_TOKEN="${token}" GITLAB_TOKEN="${token}" "${glab_bin}" config set --global git_protocol https 2>/dev/null || true
  GLAB_TOKEN="${token}" GITLAB_TOKEN="${token}" "${glab_bin}" config set --global remote_alias "${YIELDOMEGA_GITLAB_REMOTE}" 2>/dev/null \
    || GLAB_TOKEN="${token}" GITLAB_TOKEN="${token}" "${glab_bin}" config set remote_alias "${YIELDOMEGA_GITLAB_REMOTE}" 2>/dev/null \
    || true
  GLAB_TOKEN="${token}" GITLAB_TOKEN="${token}" "${glab_bin}" config set remote.origin_url "${clean_url}" 2>/dev/null || true
  if [[ -n "${token}" ]]; then
    GLAB_TOKEN="${token}" GITLAB_TOKEN="${token}" "${glab_bin}" config set --host "${YIELDOMEGA_GITLAB_HOST}" token "${token}" 2>/dev/null \
      || GLAB_TOKEN="${token}" GITLAB_TOKEN="${token}" "${glab_bin}" config set token "${token}" 2>/dev/null \
      || true
    GLAB_TOKEN="${token}" GITLAB_TOKEN="${token}" "${glab_bin}" auth login --hostname "${YIELDOMEGA_GITLAB_HOST}" --token "${token}" 2>/dev/null \
      || GLAB_TOKEN="${token}" GITLAB_TOKEN="${token}" "${glab_bin}" auth status 2>/dev/null || true
  fi
  if git rev-parse --git-dir >/dev/null 2>&1; then
    git config --local "remote.${YIELDOMEGA_GITLAB_REMOTE}.glab-resolved" base 2>/dev/null || true
    git config --local glab.resolvedProject "${repo}" 2>/dev/null || true
  fi
}

# Persist GITLAB_REPO + GITLAB_TOKEN (+ GIT_USERNAME/GIT_EMAIL when present) for interactive shells (idempotent).
yieldomega_persist_glab_env() {
  local env_file="${YIELDOMEGA_CLOUD_AGENT_ENV}"
  local repo token git_username git_email
  repo="$(yieldomega_glab_repo)"
  token="$(yieldomega_glab_token)"
  git_username="${GIT_USERNAME:-}"
  git_email="${GIT_EMAIL:-}"
  if [[ -z "${git_username}" || -z "${git_email}" ]] && [[ -f "${env_file}" ]]; then
    # shellcheck source=/dev/null
    source "${env_file}"
    git_username="${GIT_USERNAME:-}"
    git_email="${GIT_EMAIL:-}"
  fi
  mkdir -p "$(dirname "${env_file}")"
  {
    echo "# Yieldomega Cloud Agent — sourced by bootstrap-cloud-vm-toolchain.sh"
    echo "export GITLAB_REPO='${repo}'"
    echo "export YIELDOMEGA_GITLAB_PROJECT='${repo}'"
    if [[ -n "${token}" ]]; then
      echo "export GITLAB_TOKEN='${token}'"
      echo "export GLAB_TOKEN='${token}'"
    fi
    if [[ -n "${git_username}" && -n "${git_email}" ]]; then
      echo "export GIT_USERNAME='${git_username}'"
      echo "export GIT_EMAIL='${git_email}'"
    fi
  } >"${env_file}.tmp"
  if [[ ! -f "${env_file}" ]] || ! cmp -s "${env_file}" "${env_file}.tmp"; then
    mv "${env_file}.tmp" "${env_file}"
  else
    rm -f "${env_file}.tmp"
  fi
  # cloud-agent.env is sourced from ~/.config/yieldomega/cloud-agent-path.sh
  # (yieldomega_persist_cloud_toolchain_path) with shell-secret preservation.
}

# Wait for apt/dpkg lock (Cloud VM install races are common).
yieldomega_wait_for_apt_lock() {
  local i
  for i in $(seq 1 60); do
    if ! fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 \
      && ! fuser /var/lib/dpkg/lock >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "yieldomega_wait_for_apt_lock: timed out waiting for apt lock." >&2
  return 1
}

# Install glab via .deb (apt) or tarball to ~/.local/bin/glab-real.
yieldomega_install_glab() {
  if yieldomega_glab_real_bin >/dev/null 2>&1; then
    return 0
  fi
  local need_sudo=0
  [[ "$(id -u)" -eq 0 ]] || command -v sudo >/dev/null 2>&1 || need_sudo=1
  if [[ "${need_sudo}" -eq 0 ]]; then
    yieldomega_wait_for_apt_lock || true
    local arch deb tmp run_as_root
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
    if [[ -n "${deb}" && "${deb}" != "null" ]]; then
      curl -fsSL -o "${tmp}/glab.deb" "${deb}"
      if [[ "$(id -u)" -eq 0 ]]; then
        DEBIAN_FRONTEND=noninteractive apt-get install -y "${tmp}/glab.deb"
      else
        sudo DEBIAN_FRONTEND=noninteractive apt-get install -y "${tmp}/glab.deb"
      fi
      yieldomega_glab_real_bin >/dev/null 2>&1 && return 0
    fi
  fi
  # Fallback: user-local binary (no sudo).
  local arch tar_url tmp
  arch="$(uname -m)"
  case "${arch}" in
    x86_64) arch="amd64" ;;
    aarch64) arch="arm64" ;;
  esac
  tmp="$(mktemp -d)"
  trap 'rm -rf "${tmp}"' RETURN
  tar_url="$(curl -fsSL "https://gitlab.com/api/v4/projects/gitlab-org%2Fcli/releases" \
    | jq -r '.[0].assets.links[] | select(.name | test("glab_.*linux_'"${arch}"'\\.tar\\.gz$")) | .direct_asset_url' \
    | head -1)"
  [[ -n "${tar_url}" && "${tar_url}" != "null" ]] || {
    echo "yieldomega_install_glab: could not resolve glab release asset." >&2
    return 1
  }
  curl -fsSL -o "${tmp}/glab.tar.gz" "${tar_url}"
  tar -xzf "${tmp}/glab.tar.gz" -C "${tmp}"
  mkdir -p "${HOME}/.local/bin"
  install -m 0755 "${tmp}/bin/glab" "${HOME}/.local/bin/glab-real"
  yieldomega_glab_real_bin >/dev/null 2>&1
}

yieldomega_glab_api_ok() {
  local token repo encoded
  token="$(yieldomega_glab_token)"
  repo="$(yieldomega_glab_repo)"
  [[ -n "${token}" ]] || return 1
  encoded="${repo//\//%2F}"
  curl -fsS -H "PRIVATE-TOKEN: ${token}" \
    "https://${YIELDOMEGA_GITLAB_HOST}/api/v4/projects/${encoded}" >/dev/null 2>&1
}

yieldomega_glab_project_id() {
  local token repo encoded
  token="$(yieldomega_glab_token)"
  repo="$(yieldomega_glab_repo)"
  [[ -n "${token}" ]] || return 1
  encoded="${repo//\//%2F}"
  curl -fsS -H "PRIVATE-TOKEN: ${token}" \
    "https://${YIELDOMEGA_GITLAB_HOST}/api/v4/projects/${encoded}" \
    | jq -r '.id // empty'
}

yieldomega_glab_repo_context_ok() {
  yieldomega_glab mr list --per-page 1 >/dev/null 2>&1
}

# Create an MR via GitLab REST API (used by scripts/glab-mr-create.sh).
yieldomega_glab_mr_create_api() {
  local source_branch="$1"
  local target_branch="$2"
  local title="$3"
  local description="${4:-}"
  local draft="${5:-0}"
  local token project_id args=() response http_code body

  token="$(yieldomega_glab_token)"
  project_id="$(yieldomega_glab_project_id)"
  [[ -n "${token}" && -n "${project_id}" ]] || return 1

  args=(
    -sS -w "\n%{http_code}"
    -X POST
    -H "PRIVATE-TOKEN: ${token}"
    --data-urlencode "source_branch=${source_branch}"
    --data-urlencode "target_branch=${target_branch}"
    --data-urlencode "title=${title}"
  )
  [[ -n "${description}" ]] && args+=(--data-urlencode "description=${description}")
  [[ "${draft}" == "1" ]] && args+=(--data-urlencode "draft=yes")

  response="$(curl "${args[@]}" \
    "https://${YIELDOMEGA_GITLAB_HOST}/api/v4/projects/${project_id}/merge_requests" 2>&1)" || return 1
  http_code="${response##*$'\n'}"
  body="${response%$'\n'*}"

  if [[ "${http_code}" =~ ^2 ]]; then
    echo "${body}" | jq -r '.web_url // empty'
    return 0
  fi

  echo "yieldomega_glab_mr_create_api: HTTP ${http_code}: ${body}" >&2
  return 1
}

yieldomega_glab_mr_create() {
  local source_branch="$1"
  local target_branch="$2"
  local title="$3"
  local description="${4:-}"
  local draft="${5:-0}"

  yieldomega_glab_mr_create_api "${source_branch}" "${target_branch}" "${title}" "${description}" "${draft}"
}
