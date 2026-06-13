# Golden image finalize (yieldomega)

You are finishing configuration of a **GCH agent VM golden image** for the YieldOmega EVM project. Bootstrap and **`bash scripts/e2e-anvil.sh`** have already run from `gch-cloud-setup.sh` (see `/home/agent/.gch/e2e-anvil.log` — must end with **`Done.`**).

Complete remaining verification and write the golden-image report. Use passwordless sudo as needed.

**Log first:** `mkdir -p /home/agent/.gch` and create or append **`/home/agent/.gch/golden-image-verify.log`**. Record **PASS/FAIL/SKIP** after each task. Do **not** end until the log exists with **`OVERALL:`**.

**Do not run `bash scripts/e2e-anvil.sh` in this session.** The Cursor shell tool kills long foreground runs (~10 min, exit **143**). E2E is executed by setup, not the agent.

## Tasks

1. **Anvil E2E gate (required)**
   - Confirm `/home/agent/.gch/e2e-anvil.log` exists and ends with `Done.`
   - Confirm `grep -q 'e2e-anvil.sh: PASS' /home/agent/.gch/golden-image-verify.log` (written by the script when `YIELDOMEGA_GOLDEN_IMAGE=1`)
   - If either check fails, **stop** and report **OVERALL: FAIL** — admin must re-run setup E2E:
     ```bash
     sudo -u agent env YIELDOMEGA_GOLDEN_IMAGE=1 PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 \
       bash -lc 'bash /home/agent/workspace/scripts/e2e-anvil.sh 2>&1 | tee /home/agent/.gch/e2e-anvil.log'
     ```
     Do **not** attempt that re-run inside this agent session.

2. **Rabby wallet extension**
   - `/opt/cursor/browser-extensions/rabby/manifest.json` present
   - Profile: `/opt/cursor/chrome-profile-rabby`
   - If marker missing, import wallets (see `docs/testing/rabby-cloud-agent-qa.md`):
     ```bash
     pkill -9 -f 'chrome-profile-rabby' 2>/dev/null || true
     rm -f /opt/cursor/chrome-profile-rabby/SingletonLock
     timeout 300 xvfb-run -a bash -c 'cd frontend && node ../scripts/setup-rabby-dev-wallets.mjs'
     ```
   - Smoke: `bash scripts/verify-rabby-playwright-injection.sh`

3. **Toolchain**
   - `forge --version`, `anvil --version`, `rustc --version`, `node --version`, `agent about`, `glab --version`
   - `bash scripts/verify-cloud-postgres.sh` (indexer Postgres :5433)
   - Optional: `FOUNDRY_PROFILE=ci forge test` in `contracts/` — five known failures (DoubAirdropMegaethFork missing `doub.csv`, DevStackIntegration env flake) are **not** golden-image blockers; record pass/fail counts only.

4. **Write report**
   - Append all results to `/home/agent/.gch/golden-image-verify.log`
   - End with `OVERALL: PASS` only if e2e-anvil gate + Rabby smoke + postgres pass; else `OVERALL: FAIL` with blockers
   - `test -f /home/agent/.gch/golden-image-verify.log && wc -l /home/agent/.gch/golden-image-verify.log`

## Constraints

- **Mandatory log file** before exit.
- No pre-snapshot cleanup. No commits unless required to verify.
- Docs: `AGENTS.md`, `docs/testing/e2e-anvil.md`, `docs/testing/rabby-cloud-agent-qa.md`
