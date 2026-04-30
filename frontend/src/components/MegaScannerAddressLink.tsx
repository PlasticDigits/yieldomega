// SPDX-License-Identifier: AGPL-3.0-only

import { useIsViewportAtMost } from "@/hooks/useIsViewportAtMost";
import { abbreviateAddressEnds } from "@/lib/addressFormat";
import { explorerAddressUrl } from "@/lib/explorer";

const MOBILE_ADDRESS_VIEWPORT_MAX = 479;

type Props = {
  /** Checksummed or lower-case hex `0x` + 20 bytes */
  address: string;
  className?: string;
};

/**
 * Monospace explorer link — full address ≥480px viewport; **`0xab…1234`** (first 4 + last 4 characters) ≤479px ([GitLab #93](https://gitlab.com/PlasticDigits/yieldomega/-/issues/93)); base URL follows **`VITE_EXPLORER_BASE_URL`** with **`AddressInline`** ([GitLab #98](https://gitlab.com/PlasticDigits/yieldomega/-/issues/98)).
 */
export function MegaScannerAddressLink({ address, className }: Props) {
  const narrow = useIsViewportAtMost(MOBILE_ADDRESS_VIEWPORT_MAX);
  const href = explorerAddressUrl(address);

  const full = address.trim();
  const display = narrow ? abbreviateAddressEnds(full, 4, 4) : full;

  const cls = ["mono", "mega-scanner-addr-link", className].filter(Boolean).join(" ");

  if (!href) {
    return (
      <span className={cls} title={address.trim()}>
        {display}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={`${cls} cursor-external-link`}
      title={address.trim()}
    >
      {display}
    </a>
  );
}
