// SPDX-License-Identifier: AGPL-3.0-only

import { useLocation } from "react-router-dom";
import { useAccount, useReadContract } from "wagmi";
import { PageBadge } from "@/components/ui/PageBadge";
import { doubPresaleVestingReadAbi } from "@/lib/abis";
import { addresses } from "@/lib/addresses";

function isTimecurveSurfacePath(pathname: string): boolean {
  return pathname === "/timecurve" || pathname.startsWith("/timecurve/");
}

/** Header hint when the connected wallet is a `DoubPresaleVesting` beneficiary — matches onchain `TimeCurve` presale CHARM weight bonus. */
export function TimecurvePresaleCharmHeaderBadge() {
  const { pathname } = useLocation();
  const { address } = useAccount();
  const vesting = addresses.doubPresaleVesting;
  const surface = isTimecurveSurfacePath(pathname);
  const { data: isBeneficiary } = useReadContract({
    address: vesting,
    abi: doubPresaleVestingReadAbi,
    functionName: "isBeneficiary",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(surface && vesting && address) },
  });

  if (!surface || !vesting || !address || !isBeneficiary) {
    return null;
  }

  return (
    <PageBadge
      label="Presale +15% CHARM"
      tone="info"
      className="app-header__presale-charm-badge"
    />
  );
}
