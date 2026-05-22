// SPDX-License-Identifier: AGPL-3.0-only

import { buyTokenOnKumbayaUrl } from "@/lib/kumbayaSwapUrl";
import type { HexAddress } from "@/lib/addresses";

const CL8Y_BRIDGE_URL = "https://bridge.cl8y.com";

function ExternalLinkIcon() {
  return (
    <svg
      className="external-text-link__icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"
      />
    </svg>
  );
}

type Cl8yAcquireExternalLinksProps = {
  cl8yToken: HexAddress | undefined;
  className?: string;
  buyTestId?: string;
  bridgeTestId?: string;
};

/** Outbound buy + bridge links when the wallet cannot cover a CL8Y spend (Simple buy, referrals register). */
export function Cl8yAcquireExternalLinks({
  cl8yToken,
  className,
  buyTestId = "cl8y-acquire-buy-kumbaya-link",
  bridgeTestId = "cl8y-acquire-bridge-link",
}: Cl8yAcquireExternalLinksProps) {
  const rootClass = ["cl8y-acquire-links", className].filter(Boolean).join(" ");

  return (
    <div className={rootClass}>
      <a
        href={buyTokenOnKumbayaUrl(cl8yToken)}
        target="_blank"
        rel="noreferrer noopener"
        className="external-text-link cursor-external-link"
        data-testid={buyTestId}
        aria-label="Buy CL8Y on Kumbaya (opens in new tab)"
      >
        <span className="external-text-link__label">Buy CL8Y on Kumbaya</span>
        <ExternalLinkIcon />
      </a>
      <a
        href={CL8Y_BRIDGE_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="external-text-link cursor-external-link"
        data-testid={bridgeTestId}
        aria-label="Bridge CL8Y (opens in new tab)"
      >
        <span className="external-text-link__label">Bridge CL8Y</span>
        <ExternalLinkIcon />
      </a>
    </div>
  );
}
