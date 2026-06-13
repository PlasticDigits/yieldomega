# Golden image finalize (yieldomega)

You are finishing configuration of a **GCH agent VM golden image** for the YieldOmega EVM project. The base OS packages, Docker, Rust, Foundry, Node, Playwright, glab, and Cursor CLI are already installed. Project bootstrap scripts (`bootstrap-dev.sh`, `bootstrap-cloud-vm-toolchain.sh`, `bootstrap-cloud-postgres-native.sh`, `bootstrap-cloud-agent.sh`) have already run.

Complete any remaining setup and verify everything works. Use passwordless sudo as needed (`sudo` without a password).

**Log first:** Before any other task, run `mkdir -p /home/agent/.gch` and create `/home/agent/.gch/golden-image-verify.log` with a header line. **Append PASS/FAIL/SKIP after each task below** — do not wait until the end. If you are running out of time or the session may stop, write `OVERALL:` and exit only after the log file exists.

## Tasks

1. **Rabby wallet extension**
   - Confirm unpacked Rabby at `/opt/cursor/browser-extensions/rabby/manifest.json`
   - If missing, run: `sudo bash scripts/install-browser-extensions.sh`
   - Chrome profile for Rabby: `/opt/cursor/chrome-profile-rabby`
   - Import dev wallets if marker missing (`/opt/cursor/chrome-profile-rabby/.yieldomega-rabby-dev-wallets-ready`):
     ```bash
     pkill -9 -f 'chrome-profile-rabby' 2>/dev/null || true
     rm -f /opt/cursor/chrome-profile-rabby/SingletonLock
     YIELDOMEGA_RABBY_WALLET_IMPORT_TIMEOUT_SEC=600 \
       xvfb-run -a bash -c 'cd frontend && node ../scripts/setup-rabby-dev-wallets.mjs'
     ```
     If import hangs or is killed, note **SKIP** in the verify log — agents can still run mock-wallet E2E; full Rabby QA is documented in `docs/testing/rabby-cloud-agent-qa.md`.

2. **Anvil (local EVM)**
   - Verify Foundry (`forge`, `cast`, `anvil`) on PATH (`~/.foundry/bin`)
   - Start Anvil with project flags (chain id **31337**, large code size for DeployDev):
     ```bash
     anvil --host 127.0.0.1 --port 8545 --code-size-limit 524288
     ```
   - Confirm RPC responds: `cast block-number --rpc-url http://127.0.0.1:8545`
   - See `docs/testing/e2e-anvil.md` and `scripts/e2e-anvil.sh` for the full deploy + E2E path

3. **Playwright + frontend**
   - Playwright browsers must come from `frontend/package-lock.json` (not a separate sandbox install)
   - Smoke: `bash scripts/verify-rabby-playwright-injection.sh`
   - Optional strong signal: `bash scripts/e2e-anvil.sh`

4. **Verify toolchain** — run and record results:
   - `rustc --version` and `cargo --version`
   - `forge --version` and `anvil --version`
   - `docker ps` and `docker compose version` (or note native Postgres path if Docker unavailable)
   - `node --version` and Playwright Chromium launch smoke test
   - `agent about`
   - `glab --version`
   - `bash scripts/verify-cloud-postgres.sh` (indexer Postgres on port 5433)
   - Project tests (optional on builder — record SKIP if not run): `FOUNDRY_PROFILE=ci forge test` in `contracts/`. Five failures in `DoubAirdropMegaethFork` (missing `doub.csv`) and occasional `DevStackIntegration` env ordering are **known/expected** — note counts, do not debug at length.

5. **Write report (required — do this even if earlier steps fail)**
   - **Always** create `/home/agent/.gch/golden-image-verify.log` before you finish — success or failure.
   - Run `mkdir -p /home/agent/.gch` if needed.
   - For each check above, record **PASS**, **FAIL**, or **SKIP** with the command run and relevant output.
   - If a step fails, hangs, or is skipped, note why and continue; do **not** exit without writing the log.
   - End the log with an overall line: `OVERALL: PASS` or `OVERALL: FAIL` plus a short summary.
   - Example:
     ```bash
     mkdir -p /home/agent/.gch
     # append results as you go, then:
     tee /home/agent/.gch/golden-image-verify.log <<'EOF'
     === yieldomega golden image verify ===
     ...
     OVERALL: FAIL — Rabby wallet import SKIP (OOM); injection PASS; postgres PASS
     EOF
     ```
   - Confirm the file exists: `test -f /home/agent/.gch/golden-image-verify.log && wc -l /home/agent/.gch/golden-image-verify.log`

## Constraints

- **Writing `/home/agent/.gch/golden-image-verify.log` is mandatory.** Do not end your turn until that file exists on disk.
- Do **not** run pre-snapshot cleanup (admin runs that before imaging)
- Do **not** commit or push changes unless required to verify the build; if you commit, do not add Cursor attribution trailers
- Prefer project-documented versions and paths (`AGENTS.md`, `docs/testing/rabby-cloud-agent-qa.md`)
