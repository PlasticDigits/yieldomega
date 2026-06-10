// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {AnvilKumbayaRouter} from "./AnvilKumbayaFixture.sol";
import {FullMath} from "../oracle/v3/FullMath.sol";

/// @notice Local Kumbaya liquidity: **DOUB/CL8Y**, **CL8Y/WETH**, **WETH/USDM** only (no direct DOUB/WETH).
/// @dev Spot on the constant-product router stands in for TWAP on Anvil (#303 rehearsal).
library AnvilKumbayaPools {
    uint256 internal constant WAD = 1e18;

    uint24 internal constant DOUB_CL8Y_FEE = 100;
    uint24 internal constant CL8Y_WETH_FEE = 100;
    uint24 internal constant WETH_USDM_FEE = 3000;

    /// ~31_000 DOUB per 1 CL8Y (~$1 CL8Y at ~$1 / 31k DOUB).
    uint256 internal constant R_CL8Y_DOUB_IN = 100_000e18;
    uint256 internal constant R_DOUB_CL8Y_OUT = 3_100_000_000e18;

    /// ~1_600 CL8Y per 1 WETH ($1 CL8Y, $1_600 ETH).
    uint256 internal constant R_WETH_CL8Y_IN = 1_000e18;
    uint256 internal constant R_CL8Y_WETH_OUT = 1_600_000e18;

    /// ~1_600 USDM per 1 WETH ($1 USDM).
    uint256 internal constant R_USDM_WETH_IN = 1_600_000e18;
    uint256 internal constant R_WETH_USDM_OUT = 1_000e18;

    function wireLiquidity(
        AnvilKumbayaRouter router,
        address doub,
        address cl8y,
        address weth,
        address usdm
    ) internal {
        router.setPair(cl8y, doub, R_CL8Y_DOUB_IN, R_DOUB_CL8Y_OUT);
        router.setPair(weth, cl8y, R_WETH_CL8Y_IN, R_CL8Y_WETH_OUT);
        router.setPair(usdm, weth, R_USDM_WETH_IN, R_WETH_USDM_OUT);
    }

    /// @dev Mirrors production `ArenaCharmPriceTwap` anchor: `charmPriceWad = floor(1e36 / doubUsdWad)`.
    function charmPriceWadFromSpot(
        AnvilKumbayaRouter router,
        address doub,
        address cl8y,
        address weth,
        address usdm
    ) internal view returns (uint256 charmPriceWad, uint256 doubUsdWad) {
        bytes memory path = abi.encodePacked(
            doub,
            DOUB_CL8Y_FEE,
            cl8y,
            CL8Y_WETH_FEE,
            weth,
            WETH_USDM_FEE,
            usdm
        );
        (uint256 usdmPerDoub,,,) = router.quoteExactOutput(path, WAD);
        require(usdmPerDoub > 0, "AnvilKumbayaPools: zero doub USD");
        doubUsdWad = usdmPerDoub;
        charmPriceWad = FullMath.mulDiv(WAD, WAD, usdmPerDoub);
        require(charmPriceWad > 0, "AnvilKumbayaPools: zero charm price");
    }
}
