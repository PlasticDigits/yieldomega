#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Boot script for yieldomega agent VMs — called by cloud-init on each job.
set -euo pipefail

source /etc/gch/job.env
export PATH="/home/agent/.cursor/bin:$PATH"

# EVM local chain (optional — enable if agents need Anvil)
# sudo -u agent docker compose -f /home/agent/workspace/docker-compose.anvil.yml up -d

# Playwright / wallet tests can run after agent completes
source /home/agent/gch-cloud-init-runner.sh
gch_run_job
