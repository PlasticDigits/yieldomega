// SPDX-License-Identifier: AGPL-3.0-only

export const PRODUCTION_MOCK_WALLET_ERROR =
  "Production build refused: VITE_E2E_MOCK_WALLET=1 enables the wagmi mock connector and must not ship to CDN or staging.";

export type ProductionBuildEnvGuardOptions = {
  command: string;
  /** Playwright Anvil E2E (`scripts/e2e-anvil.sh`) sets ANVIL_E2E=1 before `npm run build`. */
  allowE2EMockWallet?: boolean;
};

/**
 * Fail closed when a production Vite build would inline the Playwright mock wallet flag.
 * Dev server (`vite`) is unaffected; see `vite.config.ts`.
 */
export function assertProductionBuildEnv(
  env: Record<string, string | undefined>,
  options: ProductionBuildEnvGuardOptions,
): void {
  if (options.command !== "build") return;
  if (options.allowE2EMockWallet) return;
  if (env.VITE_E2E_MOCK_WALLET?.trim() === "1") {
    throw new Error(
      `${PRODUCTION_MOCK_WALLET_ERROR} Unset it for production builds, or set ANVIL_E2E=1 only for scripts/e2e-anvil.sh Playwright builds. See docs/testing/e2e-anvil.md (GitLab #327).`,
    );
  }
}
