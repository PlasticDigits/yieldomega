# SPDX-License-Identifier: AGPL-3.0-only
.PHONY: help start-qa qa-start qa-tunnel-help stop-qa status

help:
	@echo "Yieldomega QA / local stack"
	@echo "  make start-qa       - QA server: tear down prior stack, Postgres + Anvil + deploy + indexer; writes .deploy/local.env"
	@echo "  make qa-start       - Same as make start-qa"
	@echo "  make qa-tunnel-help - Reprint SSH tunnel + laptop steps (after start-qa)"
	@echo "  make stop-qa        - Stop Anvil, indexer, Postgres container"
	@echo "  make status         - Check Postgres, Anvil, indexer (and optional Vite)"
	@echo "  See scripts/qa/README.md"

start-qa:
	@chmod +x scripts/qa/start-qa.sh scripts/qa/stop-qa.sh scripts/qa/print-qa-tunnel-instructions.sh scripts/qa/write-frontend-env-local.sh scripts/start-local-anvil-stack.sh
	./scripts/qa/start-qa.sh

qa-start: start-qa

qa-tunnel-help:
	@chmod +x scripts/qa/print-qa-tunnel-instructions.sh
	./scripts/qa/print-qa-tunnel-instructions.sh

stop-qa:
	@chmod +x scripts/qa/stop-qa.sh
	./scripts/qa/stop-qa.sh

status:
	@chmod +x scripts/status.sh
	./scripts/status.sh
