// SPDX-License-Identifier: AGPL-3.0-only

import { type Dispatch, type SetStateAction, useEffect, useRef } from "react";
import { chainMismatchWriteMessage, type ChainConfigEnvSlice } from "@/lib/chainMismatchWriteGuard";
import { shouldResetWriteContractErrorAfterChainTransition } from "@/pages/presaleVesting/presaleVestingWriteErrorChainReset";

export function usePresaleVestingChainWriteEffects(opts: {
  chainId: number;
  writeContractError: Error | null | undefined;
  resetWrite: () => void;
  setClaimGateError: Dispatch<SetStateAction<string | null>>;
  /** Vitest: deterministic `VITE_CHAIN_ID` / `VITE_RPC_URL` slice (defaults to `import.meta.env`). */
  chainEnv?: ChainConfigEnvSlice;
}) {
  const { chainId, writeContractError, resetWrite, setClaimGateError, chainEnv } = opts;
  const prevChainIdRef = useRef(chainId);

  useEffect(() => {
    const env = chainEnv ?? import.meta.env;
    const previousChainId = prevChainIdRef.current;
    prevChainIdRef.current = chainId;

    if (!chainMismatchWriteMessage(chainId, env)) {
      setClaimGateError(null);
    }

    if (
      shouldResetWriteContractErrorAfterChainTransition(
        previousChainId,
        chainId,
        !!writeContractError,
        env,
      )
    ) {
      resetWrite();
    }
  }, [chainId, chainEnv, writeContractError, resetWrite, setClaimGateError]);
}
