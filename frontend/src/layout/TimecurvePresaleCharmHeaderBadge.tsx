// SPDX-License-Identifier: AGPL-3.0-only

import { useLocation } from "react-router-dom";
import { useAccount, useReadContract } from "wagmi";
import { PageBadge } from "@/components/ui/PageBadge";
import { doubPresaleVestingReadAbi } from "@/lib/abis";
import { addresses } from "@/lib/addresses";

function isTimecurveSurfacePath(pathname: string): boolean {
  return pathname === "/timecurve" || pathname.startsWith("/timecurve/");
}

/** Header hint when the connected wallet receives the TimeCurve presale CHARM weight bonus (`isBeneficiary` on vesting or `PresaleCharmBeneficiaryRegistry`). */
export function TimecurvePresaleCharmHeaderBadge() {
  const { pathname } = useLocation();
  const { address } = useAccount();
  const vesting = addresses.doubPresaleVesting;
  const charmRegistry = addresses.presaleCharmBeneficiaryRegistry;
  const beneficiaryLookup = charmRegistry ?? vesting;
  const surface = isTimecurveSurfacePath(pathname);
  const { data: isBeneficiary } = useReadContract({
    address: beneficiaryLookup,
    abi: doubPresaleVestingReadAbi,
    functionName: "isBeneficiary",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(surface && beneficiaryLookup && address) },
  });

  if (!surface || !beneficiaryLookup || !address || !isBeneficiary) {
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
