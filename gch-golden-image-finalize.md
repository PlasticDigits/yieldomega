# Golden image finalize (yieldomega)

You are finishing configuration of a **GCH agent VM golden image** for the YieldOmega EVM project. The base OS packages, Docker, Rust, Foundry, Node, Playwright, glab, and Cursor CLI are already installed. Project bootstrap scripts (`bootstrap-dev.sh`, `bootstrap-cloud-vm-toolchain.sh`, `bootstrap-cloud-postgres-native.sh`, `bootstrap-cloud-agent.sh`) have already run.

Complete any remaining setup and verify everything works. Use passwordless sudo as needed (`sudo` without a password).

## Tasks

1. **Rabby wallet extension**
   - Confirm unpacked Rabby at `/opt/cursor/browser-extensions/rabby/manifest.json`
   - If missing, run: `sudo bash scripts/install-browser-extensions.sh`
   - Chrome profile for Rabby: `/opt/cursor/chrome-profile-rabby`
   - Re-run wallet import if needed: `bash scripts/bootstrap-cloud-agent.sh` (requires `DISPLAY=:99` or `xvfb-run`)

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
   - Project tests: `FOUNDRY_PROFILE=ci forge test` (contracts), `cd frontend && npm test` if documented

5. **Write report**
   - Summarize what you installed, configured, and verified
   - List any failures or manual follow-ups for the admin
   - Save to `/home/agent/.gch/golden-image-verify.log`

## Constraints

- Do **not** run pre-snapshot cleanup (admin runs that before imaging)
- Do **not** commit or push changes unless required to verify the build; if you commit, do not add Cursor attribution trailers
- Prefer project-documented versions and paths (`AGENTS.md`, `docs/testing/rabby-cloud-agent-qa.md`)
