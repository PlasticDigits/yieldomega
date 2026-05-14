// SPDX-License-Identifier: AGPL-3.0-only
import { kumbayaDexUrl } from "@/lib/addresses";

/**
 * Builds an outbound link to Kumbaya's swap page with a specified token as the
 * output currency. Used by the referrals register card so participants can buy CL8Y
 * to cover the registration burn without leaving context (GitLab #206).
 *
 * Centralized per spec — see `docs/integrations/kumbaya.md` (GitLab #46).
 *
 * @param outputToken - canonical ERC-20 address (typically resolved live from
 *                      `ReferralRegistry.cl8yToken()` rather than env, since CL8Y
 *                      isn't currently in `addresses`)
 */
const KUMBAYA_SWAP_FALLBACK = "https://www.kumbaya.xyz/#/swap";

export function buyTokenOnKumbayaUrl(outputToken: string | undefined): string {
  const base = (kumbayaDexUrl() ?? KUMBAYA_SWAP_FALLBACK).replace(/\/$/, "");
  const swapBase = base.endsWith("/swap") || base.includes("/#/swap") ? base : `${base}/#/swap`;
  if (!outputToken || outputToken.length === 0) {
    return swapBase;
  }
  // `confirmed=1` suppresses Kumbaya's "are you sure this token is real" gate
  // for our canonical CL8Y per integrator-kit token list.
  return `${swapBase}?outputCurrency=${outputToken}&confirmed=1`;
}
