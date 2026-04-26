import { ThirdPartyDexPage } from "@/components/ThirdPartyDexPage";
import { kumbayaDexUrl } from "@/lib/addresses";

// SPDX-License-Identifier: AGPL-3.0-only

export function KumbayaPage() {
  return (
    <ThirdPartyDexPage
      title="Kumbaya"
      slug="kumbaya"
      heroImage="/art/kumbaya-card.jpg"
      heroImageWidth={1536}
      heroImageHeight={1024}
      venueDescription="DOUB / CL8Y (spot pool)"
      externalUrl={kumbayaDexUrl()}
      linkLabel="Open Kumbaya DEX"
      envVarName="VITE_KUMBAYA_DEX_URL"
    />
  );
}
