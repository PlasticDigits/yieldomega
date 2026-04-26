// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {TimeCurve} from "./TimeCurve.sol";

/// @notice Wrapped native asset (deposit / withdraw).
interface IWETH is IERC20 {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
}

/// @notice Kumbaya / Uniswap V3–style `exactOutput` on SwapRouter02 or Anvil fixture (GitLab #41 / #46).
interface IKumbayaSwapRouter {
    struct ExactOutputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountOut;
        uint256 amountInMaximum;
    }

    function exactOutput(ExactOutputParams calldata params) external payable returns (uint256 amountIn);
}

/// @title TimeCurveBuyRouter — single transaction ETH or stable → Kumbaya `exactOutput` → `TimeCurve.buyFor`
/// @notice Pulls spend from `msg.sender`, swaps to **exact** TimeCurve gross CL8Y for `charmWad`, then `buyFor`.
///         Path must be v3 packed **tokenOut (CL8Y) → … → tokenIn (WETH or `stableToken`)** per `docs/integrations/kumbaya.md`.
/// @dev Immutable companion: owner wires `TimeCurve.setTimeCurveBuyRouter(address(this))`. Trust model: same team as TimeCurve admin.
contract TimeCurveBuyRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    TimeCurve public immutable timeCurve;
    IKumbayaSwapRouter public immutable kumbayaRouter;
    IWETH public immutable weth;
    /// @notice Set to Anvil USDM or MegaETH USDm; `address(0)` disables ERC20-stable entry (ETH-only).
    IERC20 public immutable stableToken;

    uint256 internal constant WAD = 1e18;

    error TimeCurveBuyRouter__BadSalePhase();
    error TimeCurveBuyRouter__BadPath();
    error TimeCurveBuyRouter__CharmBounds();
    error TimeCurveBuyRouter__EthMode();
    error TimeCurveBuyRouter__StableMode();
    error TimeCurveBuyRouter__StableNotConfigured();
    error TimeCurveBuyRouter__EthValue();

    event BuyViaKumbaya(address indexed buyer, uint256 charmWad, uint256 grossCl8y, uint8 payKind);

    /// @param stableToken_ Pass `address(0)` if only ETH (WETH) pay mode is allowed on this deployment.
    constructor(TimeCurve timeCurve_, address kumbayaRouter_, address weth_, address stableToken_) {
        timeCurve = timeCurve_;
        kumbayaRouter = IKumbayaSwapRouter(kumbayaRouter_);
        weth = IWETH(weth_);
        stableToken = IERC20(stableToken_);
    }

    /// @dev `payKind`: **0** = ETH (`msg.value` wraps to WETH; path must end in WETH), **1** = `stableToken` (approve this router).
    uint8 public constant PAY_ETH = 0;
    uint8 public constant PAY_STABLE = 1;

    /// @notice `path` last token must be WETH for `PAY_ETH`, or `stableToken` for `PAY_STABLE`. First token must be TimeCurve accepted asset (CL8Y).
    /// @param plantWarBowFlag Forwarded to `TimeCurve.buyFor` — opt-in WarBow pending flag ([GitLab #63](https://gitlab.com/PlasticDigits/yieldomega/-/issues/63)).
    function buyViaKumbaya(
        uint256 charmWad,
        bytes32 codeHash,
        bool plantWarBowFlag,
        uint8 payKind,
        uint256 swapDeadline,
        uint256 amountInMaximum,
        bytes calldata path
    ) external payable nonReentrant {
        if (payKind > PAY_STABLE) revert TimeCurveBuyRouter__BadPath();

        TimeCurve tc = timeCurve;
        if (tc.saleStart() == 0 || tc.ended() || block.timestamp >= tc.deadline()) revert TimeCurveBuyRouter__BadSalePhase();

        (uint256 minCharm, uint256 maxCharm) = tc.currentCharmBoundsWad();
        if (charmWad < minCharm || charmWad > maxCharm) revert TimeCurveBuyRouter__CharmBounds();

        uint256 grossCl8y = Math.mulDiv(charmWad, tc.currentPricePerCharmWad(), WAD);
        if (grossCl8y == 0) revert TimeCurveBuyRouter__BadSalePhase();

        address cl8y = address(tc.acceptedAsset());
        _validatePath(path, cl8y, payKind);

        IERC20 cl8yTok = IERC20(cl8y);
        uint256 cl8yBefore = cl8yTok.balanceOf(address(this));
        IERC20 wethErc = IERC20(address(weth));

        if (payKind == PAY_ETH) {
            if (msg.value == 0) revert TimeCurveBuyRouter__EthValue();
            weth.deposit{value: msg.value}();
            wethErc.forceApprove(address(kumbayaRouter), amountInMaximum);
        } else {
            if (address(stableToken) == address(0)) revert TimeCurveBuyRouter__StableNotConfigured();
            stableToken.safeTransferFrom(msg.sender, address(this), amountInMaximum);
            stableToken.forceApprove(address(kumbayaRouter), amountInMaximum);
        }

        kumbayaRouter.exactOutput(
            IKumbayaSwapRouter.ExactOutputParams({
                path: path,
                recipient: address(this),
                deadline: swapDeadline,
                amountOut: grossCl8y,
                amountInMaximum: amountInMaximum
            })
        );

        if (payKind == PAY_ETH) {
            wethErc.forceApprove(address(kumbayaRouter), 0);
            uint256 wethLeft = weth.balanceOf(address(this));
            if (wethLeft > 0) {
                weth.withdraw(wethLeft);
                (bool ok,) = payable(msg.sender).call{value: wethLeft}("");
                require(ok, "TimeCurveBuyRouter: eth refund");
            }
        } else {
            stableToken.forceApprove(address(kumbayaRouter), 0);
            uint256 stLeft = stableToken.balanceOf(address(this));
            if (stLeft > 0) {
                stableToken.safeTransfer(msg.sender, stLeft);
            }
        }

        uint256 cl8yGain = cl8yTok.balanceOf(address(this)) - cl8yBefore;
        if (cl8yGain < grossCl8y) revert TimeCurveBuyRouter__BadSalePhase();

        cl8yTok.forceApprove(address(tc), grossCl8y);
        tc.buyFor(msg.sender, charmWad, codeHash, plantWarBowFlag);
        cl8yTok.forceApprove(address(tc), 0);

        uint256 dust = cl8yTok.balanceOf(address(this));
        if (dust > 0) {
            cl8yTok.safeTransfer(msg.sender, dust);
        }

        emit BuyViaKumbaya(msg.sender, charmWad, grossCl8y, payKind);
    }

    receive() external payable {}

    function _validatePath(bytes calldata path, address cl8y, uint8 payKind) internal view {
        if (path.length < 43 || (path.length - 20) % 23 != 0) revert TimeCurveBuyRouter__BadPath();

        address first;
        assembly {
            first := shr(96, calldataload(path.offset))
        }
        if (first != cl8y) revert TimeCurveBuyRouter__BadPath();

        address last;
        unchecked {
            uint256 off = path.length - 20;
            assembly {
                last := shr(96, calldataload(add(path.offset, off)))
            }
        }

        if (payKind == PAY_ETH) {
            if (last != address(weth)) revert TimeCurveBuyRouter__EthMode();
        } else {
            if (last != address(stableToken)) revert TimeCurveBuyRouter__StableMode();
        }
    }
}
