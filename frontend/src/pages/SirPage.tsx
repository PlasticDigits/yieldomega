import { ThirdPartyDexPage } from "@/components/ThirdPartyDexPage";
import { sirDexUrl } from "@/lib/addresses";

// SPDX-License-Identifier: AGPL-3.0-only

export function SirPage() {
  return (
    <ThirdPartyDexPage
      title="Sir"
      slug="sir"
      heroImage="/art/scenes/sir-strip.jpg"
      venueDescription="DOUB levs / derivatives (per venue listing)"
      externalUrl={sirDexUrl()}
      linkLabel="Open Sir DEX"
      envVarName="VITE_SIR_DEX_URL"
      venueKind="leverage trading platform"
    />
  );
}
