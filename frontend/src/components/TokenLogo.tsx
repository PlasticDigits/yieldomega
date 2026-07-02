// SPDX-License-Identifier: AGPL-3.0-only

import { CharmTokenIcon } from "@/components/CharmTokenIcon";
import { CredTokenIcon } from "@/components/CredTokenIcon";
import { CHARM_TOKEN_LOGO, CRED_TOKEN_LOGO } from "@/lib/tokenMedia";

type Props = {
  src: string;
  className?: string;
  width?: number;
  height?: number;
};

/** Token mark — CHARM and CRED use inline SVG glyphs; other tokens stay on static assets. */
export function TokenLogo({ src, className, width = 18, height = 18 }: Props) {
  if (src === CHARM_TOKEN_LOGO) {
    return <CharmTokenIcon className={["charm-token-icon", className].filter(Boolean).join(" ")} width={width} height={height} />;
  }
  if (src === CRED_TOKEN_LOGO) {
    return <CredTokenIcon className={["cred-token-icon", className].filter(Boolean).join(" ")} width={width} height={height} />;
  }
  return (
    <img
      src={src}
      alt=""
      width={width}
      height={height}
      decoding="async"
      className={className}
      aria-hidden
    />
  );
}
