// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {AdminSellVault} from "../src/arena/AdminSellVault.sol";
import {AnvilMockUSDM} from "../src/fixtures/AnvilKumbayaFixture.sol";

interface IKumbayaExactInputSingle {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external returns (uint256 amountOut);
}

/// @dev Stand-in for Kumbaya `exactInputSingle` (AnvilKumbayaRouter is exactOutput-only).
contract MockKumbayaExactInputSingle is IKumbayaExactInputSingle {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdm;
    uint256 public rateWad;

    constructor(IERC20 usdm_, uint256 rateWad_) {
        usdm = usdm_;
        rateWad = rateWad_;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external returns (uint256 amountOut) {
        IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        amountOut = (params.amountIn * rateWad) / 1e18;
        require(amountOut >= params.amountOutMinimum, "MockKumbaya: slippage");
        IERC20(params.tokenOut).safeTransfer(params.recipient, amountOut);
    }
}

/// @dev GitLab #249 — admin sell path with Anvil USDM fixture + mocked swap router.
contract AdminSellVaultTest is Test {
    Doubloon doub;
    AnvilMockUSDM usdm;
    AdminSellVault vault;
    MockKumbayaExactInputSingle router;

    address admin = address(this);
    address treasury = address(0xFEE);

    function setUp() public {
        doub = new Doubloon(admin);
        usdm = new AnvilMockUSDM();
        vault = new AdminSellVault(doub, admin);
        router = new MockKumbayaExactInputSingle(usdm, 2e18);

        vault.setSwapConfig(address(router), address(usdm), 3000, treasury);
        doub.grantRole(doub.MINTER_ROLE(), admin);
        doub.mint(address(vault), 300e18);
        usdm.mint(address(router), 10_000_000e18);
    }

    function test_sellDoubToUsdm_transfersUsdmToAdminAccount() public {
        uint256 usdmBefore = usdm.balanceOf(treasury);
        vault.sellDoubToUsdm(500e18);
        assertEq(doub.balanceOf(address(vault)), 0);
        assertEq(usdm.balanceOf(treasury), usdmBefore + 600e18);
    }

    function test_sellDoubToUsdm_revertsSlippage() public {
        vm.expectRevert();
        vault.sellDoubToUsdm(700e18);
    }

    function test_sellDoubToUsdm_onlyOwner() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert();
        vault.sellDoubToUsdm(0);
    }

    function test_sellDoubToUsdm_revertsWhenEmpty() public {
        vault.rescueDoub(admin, 300e18);
        vm.expectRevert("AdminSellVault: empty");
        vault.sellDoubToUsdm(0);
    }
}
