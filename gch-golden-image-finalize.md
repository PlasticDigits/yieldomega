# Golden image finalize (yieldomega)

You are finishing configuration of a **GCH agent VM golden image** for the YieldOmega EVM project. Bootstrap scripts (`bootstrap-dev.sh`, `bootstrap-cloud-vm-toolchain.sh`, `bootstrap-cloud-postgres-native.sh`, `bootstrap-cloud-agent.sh`) have already run.

Complete all verification below and write the golden-image report. Use passwordless sudo as needed.

**Log first:** `mkdir -p /home/agent/.gch` and create or append **`/home/agent/.gch/golden-image-verify.log`**. Record **PASS/FAIL/SKIP** after each task. Do **not** end until the log exists with **`OVERALL:`**.

## Tasks

1. **Anvil E2E (required — DO RUN)**
   - **Run** the full orchestrator and capture output:
     ```bash
     mkdir -p /home/agent/.gch
     export PATH="$HOME/.foundry/bin:$PATH"
     export YIELDOMEGA_GOLDEN_IMAGE=1
     cd /home/agent/workspace
     unset KEY_EVM_1 KEY_EVM_2 KEY_EVM_3 ADDR_EVM_1 ADDR_EVM_2 ADDR_EVM_3 EVM_DEV_ADDRS \
       VITE_TIME_ARENA_ADDRESS VITE_INDEXER_URL || true
     bash scripts/e2e-anvil.sh 2>&1 | tee /home/agent/.gch/e2e-anvil.log
     ```
   - What it does (see `docs/testing/e2e-anvil.md`): Anvil :8545 → `DeployDev` (+ Kumbaya fixtures) → `frontend/.env.production.local` → `npm run build` → `vite preview` :4173 → Playwright `e2e/anvil-arena-*.spec.ts` with mock wallet.
   - **PASS** when the script prints **`Done.`** and exits **0**; append **`e2e-anvil.sh: PASS`** to the verify log.
   - On failure, append **`e2e-anvil.sh: FAIL`** with last lines from `/home/agent/.gch/e2e-anvil.log` and continue other checks.

2. **Rabby wallet extension**
   - `/opt/cursor/browser-extensions/rabby/manifest.json` present
   - Profile: `/opt/cursor/chrome-profile-rabby`
   - If marker missing (`/opt/cursor/chrome-profile-rabby/.yieldomega-rabby-dev-wallets-ready`), import wallets:
     ```bash
     pkill -9 -f 'chrome-profile-rabby' 2>/dev/null || true
     rm -f /opt/cursor/chrome-profile-rabby/SingletonLock
     timeout 300 xvfb-run -a bash -c 'cd frontend && node ../scripts/setup-rabby-dev-wallets.mjs'
     ```
   - Smoke: `bash scripts/verify-rabby-playwright-injection.sh`

3. **Toolchain**
   - `forge --version`, `anvil --version`, `rustc --version`, `node --version`, `agent about`, `glab --version`
   - `bash scripts/verify-cloud-postgres.sh` (indexer Postgres :5433)
   - **Indexer prebuild** (warm `~/.cargo/registry` and `indexer/target/` so `agent:verify` skips cold compile):
     ```bash
     source /usr/local/cargo/env 2>/dev/null || true
     cd /home/agent/workspace/indexer
     cargo fetch
     cargo clippy --all-targets -- -D warnings
     cargo test --no-run
     ```
     Append **`indexer-prebuild: PASS`** or **`indexer-prebuild: FAIL`** to the verify log.
   - Optional: `FOUNDRY_PROFILE=ci forge test` in `contracts/` — five known failures (DoubAirdropMegaethFork missing `doub.csv`, DevStackIntegration env flake) are **not** golden-image blockers; record pass/fail counts only.

4. **Write report**
   - Append all results to `/home/agent/.gch/golden-image-verify.log`
   - End with `OVERALL: PASS` only if **e2e-anvil.sh** + Rabby smoke + postgres + indexer prebuild pass; else `OVERALL: FAIL` with blockers
   - Confirm: `test -f /home/agent/.gch/golden-image-verify.log && wc -l /home/agent/.gch/golden-image-verify.log`

## Constraints

- **Mandatory log file** before exit — even on failure.
- No pre-snapshot cleanup. No commits unless required to verify.
- Docs: `AGENTS.md`, `docs/testing/e2e-anvil.md`, `docs/testing/rabby-cloud-agent-qa.md`
