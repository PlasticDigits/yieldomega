// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * GitLab #203: when VITE_WALLETCONNECT_PROJECT_ID is empty, the RainbowKit Connect modal
 * must still render a populated wallet group list (not blank left panel). This is achieved
 * by using getDefaultConfig in both branches and dropping walletConnectWallet from the
 * branch-3 wallet list (since WC requires a real project id).
 */
describe("wagmiConfig — GitLab #203 empty projectId fallback", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("produces a wagmi Config with connectors when projectId is empty", async () => {
    vi.stubEnv("VITE_WALLETCONNECT_PROJECT_ID", "");
    vi.stubEnv("VITE_E2E_MOCK_WALLET", "");
    vi.stubEnv("VITE_CHAIN_ID", "31337");
    vi.stubEnv("VITE_RPC_URL", "http://127.0.0.1:8545");

    const mod = await import("./wagmi-config");
    expect(mod.wagmiConfig).toBeDefined();
    // RainbowKit getDefaultConfig produces a wagmi Config with non-empty connectors.
    // If branch 3 had fallen back to createConfig({ connectors: [injected()] }) the modal
    // would render blank. We assert connectors are present and exceed the single-injected count.
    expect(mod.wagmiConfig.connectors.length).toBeGreaterThan(1);
  });

  it("produces a wagmi Config with connectors when projectId is set", async () => {
    vi.stubEnv("VITE_WALLETCONNECT_PROJECT_ID", "test-project-id-not-real");
    vi.stubEnv("VITE_E2E_MOCK_WALLET", "");
    vi.stubEnv("VITE_CHAIN_ID", "31337");
    vi.stubEnv("VITE_RPC_URL", "http://127.0.0.1:8545");

    const mod = await import("./wagmi-config");
    expect(mod.wagmiConfig).toBeDefined();
    expect(mod.wagmiConfig.connectors.length).toBeGreaterThan(1);
  });

  it("E2E mock branch still works when VITE_E2E_MOCK_WALLET=1", async () => {
    vi.stubEnv("VITE_WALLETCONNECT_PROJECT_ID", "");
    vi.stubEnv("VITE_E2E_MOCK_WALLET", "1");
    vi.stubEnv("VITE_CHAIN_ID", "31337");
    vi.stubEnv("VITE_RPC_URL", "http://127.0.0.1:8545");

    const mod = await import("./wagmi-config");
    expect(mod.wagmiConfig).toBeDefined();
    expect(mod.wagmiConfig.connectors.length).toBe(1);
  });
});
