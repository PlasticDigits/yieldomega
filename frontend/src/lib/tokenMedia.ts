// SPDX-License-Identifier: AGPL-3.0-only

/** CHARM renders via {@link CharmTokenIcon}; other image URLs live under `frontend/public/tokens/`. */
export const CHARM_TOKEN_LOGO = "inline:charm";
export const CL8Y_TOKEN_LOGO = "/tokens/cl8y.svg";
export const DOUB_TOKEN_LOGO = "/tokens/doub.png";
export const ETH_TOKEN_LOGO = "/tokens/eth.svg";
export const USDM_TOKEN_LOGO = "/tokens/usdm.svg";
/** Play CRED — arena-only pay token (#269); render via {@link CredTokenIcon}. */
export const CRED_TOKEN_LOGO = "inline:cred";

/** MegaETH / Mega-branded surfaces (`frontend/public/tokens/mega.svg`). */
export const MEGA_MARK = "/tokens/mega.svg";

/** Chain ids where the app treats MegaETH routing defaults as first-class ([`kumbayaRoutes.ts`](./kumbayaRoutes.ts)). */
export const MEGAETH_CHAIN_IDS = new Set<number>([4326, 6343]);
