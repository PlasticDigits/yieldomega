// SPDX-License-Identifier: AGPL-3.0-only

import type { PayWithAsset } from "@/lib/kumbayaRoutes";
import {
  CL8Y_TOKEN_LOGO,
  CRED_TOKEN_LOGO,
  ETH_TOKEN_LOGO,
  USDM_TOKEN_LOGO,
} from "@/lib/tokenMedia";

export type PayTokenOption = { value: PayWithAsset; label: string; logo: string };

const BASE_PAY_TOKEN_OPTIONS: readonly PayTokenOption[] = [
  { value: "cl8y", label: "CL8Y", logo: CL8Y_TOKEN_LOGO },
  { value: "eth", label: "ETH", logo: ETH_TOKEN_LOGO },
  { value: "usdm", label: "USDM", logo: USDM_TOKEN_LOGO },
] as const;

const CRED_OPTION: PayTokenOption = { value: "cred", label: "CRED", logo: CRED_TOKEN_LOGO };

/** Buy-panel pay tokens — CRED on Arena v2 mounts (#269); submit gated when `playCred` unset. */
export function payTokenOptionsForSimpleBuy(input: { isArenaV2: boolean }): readonly PayTokenOption[] {
  if (input.isArenaV2) {
    return [...BASE_PAY_TOKEN_OPTIONS, CRED_OPTION];
  }
  return BASE_PAY_TOKEN_OPTIONS;
}
