// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  assertProductionBuildEnv,
  PRODUCTION_MOCK_WALLET_ERROR,
} from "./viteProductionEnvGuard";

describe("assertProductionBuildEnv", () => {
  it("allows dev server even when mock wallet is set", () => {
    expect(() =>
      assertProductionBuildEnv(
        { VITE_E2E_MOCK_WALLET: "1" },
        { command: "serve" },
      ),
    ).not.toThrow();
  });

  it("allows production build without mock wallet", () => {
    expect(() =>
      assertProductionBuildEnv(
        { VITE_E2E_MOCK_WALLET: "" },
        { command: "build" },
      ),
    ).not.toThrow();
  });

  it("refuses production build when VITE_E2E_MOCK_WALLET=1", () => {
    expect(() =>
      assertProductionBuildEnv(
        { VITE_E2E_MOCK_WALLET: "1" },
        { command: "build" },
      ),
    ).toThrow(PRODUCTION_MOCK_WALLET_ERROR);
  });

  it("allows production build with mock wallet when ANVIL_E2E bypass is set", () => {
    expect(() =>
      assertProductionBuildEnv(
        { VITE_E2E_MOCK_WALLET: "1" },
        { command: "build", allowE2EMockWallet: true },
      ),
    ).not.toThrow();
  });
});
