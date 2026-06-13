#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Boot script for yieldomega agent VMs — called by cloud-init on each job.
set -euo pipefail

source /etc/gch/job.env
export PATH="/home/agent/.local/bin:/home/agent/.foundry/bin:$PATH"

# Local EVM chain — agents start Anvil per job when needed (see docs/testing/e2e-anvil.md):
# sudo -u agent bash -lc 'anvil --host 127.0.0.1 --port 8545 --code-size-limit 524288 &'
# Full stack (Postgres + DeployDev + indexer): bash scripts/start-qa-local-full-stack.sh

source /home/agent/gch-cloud-init-runner.sh
gch_run_job
