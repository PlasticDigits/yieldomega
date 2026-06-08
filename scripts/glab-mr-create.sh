#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Create a GitLab merge request for PlasticDigits/yieldomega via glab api + GITLAB_TOKEN.
#
# Usage (repo root):
#   bash scripts/glab-mr-create.sh --title "My MR" --description "Details" [--draft]
#   bash scripts/glab-mr-create.sh --title "Fix" --fill   # use commit messages for description
#   bash scripts/glab-mr-create.sh --title "Fix" --template Default
#
# Env: GITLAB_TOKEN (Cursor secret), GITLAB_REPO (default PlasticDigits/yieldomega),
#      MR_TARGET_BRANCH (default main).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

# shellcheck source=scripts/lib/glab_cloud_agent.sh
source "${ROOT}/scripts/lib/glab_cloud_agent.sh"

TARGET="${MR_TARGET_BRANCH:-main}"
TITLE=""
DESCRIPTION=""
DRAFT=0
FILL=0
TEMPLATE_NAME=""
LABELS=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --title|-t)
      TITLE="${2:-}"
      shift 2
      ;;
    --description|-d|--body|-b)
      DESCRIPTION="${2:-}"
      shift 2
      ;;
    --target-branch)
      TARGET="${2:-}"
      shift 2
      ;;
    --draft)
      DRAFT=1
      shift
      ;;
    --fill)
      FILL=1
      shift
      ;;
    --template)
      TEMPLATE_NAME="${2:-Default}"
      shift 2
      ;;
    --label|-l)
      LABELS="${2:-}"
      shift 2
      ;;
    --help|-h)
      sed -n '1,20p' "$0" | tail -n +2
      exit 0
      ;;
    *)
      echo "glab-mr-create.sh: unsupported option for API create: $1" >&2
      exit 1
      ;;
  esac
done

token="$(yieldomega_glab_token)"
if [[ -z "${token}" ]]; then
  echo "glab-mr-create.sh: GITLAB_TOKEN unset (Cursor Cloud secret)." >&2
  exit 1
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "${branch}" == "HEAD" || "${branch}" == "${TARGET}" ]]; then
  echo "glab-mr-create.sh: push a feature branch first (current: ${branch})." >&2
  exit 1
fi

if ! git rev-parse "@{u}" >/dev/null 2>&1; then
  echo "glab-mr-create.sh: no upstream — run: git push -u origin ${branch}" >&2
  exit 1
fi

if [[ -z "${TITLE}" ]]; then
  TITLE="$(git log -1 --pretty=%s)"
fi

repo="$(yieldomega_glab_repo)"
if [[ "${FILL}" -eq 1 ]]; then
  DESCRIPTION="$(git log --reverse --format='### %s%n%n%b' "${TARGET}..${branch}" 2>/dev/null || git log -1 --format='### %s%n%n%b')"
elif [[ -n "${TEMPLATE_NAME}" ]]; then
  tmpl="${ROOT}/.gitlab/merge_request_templates/${TEMPLATE_NAME}.md"
  if [[ ! -f "${tmpl}" ]]; then
    echo "glab-mr-create.sh: template not found: ${tmpl}" >&2
    exit 1
  fi
  DESCRIPTION="$(<"${tmpl}")"
fi

if [[ "${DRAFT}" -eq 1 && "${TITLE}" != Draft:* && "${TITLE}" != WIP:* ]]; then
  TITLE="Draft: ${TITLE}"
fi

project="${repo//\//%2F}"
api_args=(
  "projects/${project}/merge_requests"
  -X POST
  -f "source_branch=${branch}"
  -f "target_branch=${TARGET}"
  -f "title=${TITLE}"
  -f "remove_source_branch=false"
)
if [[ -n "${DESCRIPTION}" ]]; then
  api_args+=(-f "description=${DESCRIPTION}")
fi
if [[ -n "${LABELS}" ]]; then
  api_args+=(-f "labels=${LABELS}")
fi

echo "==> glab api projects/${project}/merge_requests -X POST (source=${branch}, target=${TARGET})"
GITLAB_TOKEN="${token}" GLAB_TOKEN="${token}" glab api "${api_args[@]}" \
  | python3 -c 'import json,sys; data=json.load(sys.stdin); print(data.get("web_url", data))'
