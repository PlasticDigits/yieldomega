#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Retired with TimeCurve launchpad and v1 player reserve layer (GitLab #242).
# Arena v2 local stacks use DeployDev + scripts/start-local-anvil-stack.sh (rich state skipped by default).

set -euo pipefail

echo "anvil_rich_state.sh is retired (GitLab #242). Use Arena v2 DeployDev and start-local-anvil-stack.sh." >&2
exit 1
