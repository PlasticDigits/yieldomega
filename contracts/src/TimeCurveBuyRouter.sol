// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
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
///      Sale-phase checks mirror **`TimeCurve`** live-window rules (`block.timestamp >= saleStart` once scheduled) so **`buyViaKumbaya`**
///      fails fast before swap wiring when **`startSaleAt(epoch)`** left **`epoch` in the future** ([GitLab #118](https://gitlab.com/PlasticDigits/yieldomega/-/issues/118)).
///      Post-swap **CL8Y surplus** (exact-output dust / rounding) is sent to `cl8yProtocolTreasury`, not the buyer (GitLab #70).
///      **ETH / stable refunds** repay only \(\Delta\) balance since snapshot so pre-seeded WETH/stable cannot subsidize callers (GitLab #117).
///      `owner` may **`rescueETH` / `rescueERC20`** for stranded liquidity (typically multisig-aligned with TimeCurve ops).
contract TimeCurveBuyRouter is ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;

    TimeCurve public immutable timeCurve;
    IKumbayaSwapRouter public immutable kumbayaRouter;
    IWETH public immutable weth;
    /// @notice Set to Anvil USDM or MegaETH USDm; `address(0)` disables ERC20-stable entry (ETH-only).
    IERC20 public immutable stableToken;
    /// @notice Receives any CL8Y remaining on this router after `buyFor` (swap dust); typically `CL8YProtocolTreasury` or ops sink.
    address public immutable cl8yProtocolTreasury;

    uint256 internal constant WAD = 1e18;

    error TimeCurveBuyRouter__BadSalePhase();
    error TimeCurveBuyRouter__BadPath();
    error TimeCurveBuyRouter__CharmBounds();
    error TimeCurveBuyRouter__EthMode();
    error TimeCurveBuyRouter__StableMode();
    error TimeCurveBuyRouter__StableNotConfigured();
    error TimeCurveBuyRouter__StableIngressParity();
    error TimeCurveBuyRouter__EthValue();
    error TimeCurveBuyRouter__ZeroTreasury();
    error TimeCurveBuyRouter__RefundInvariant();
    error TimeCurveBuyRouter__RescueZeroRecipient();
    error TimeCurveBuyRouter__RescueZeroToken();
    error TimeCurveBuyRouter__RescueExceedsBalance();

    event BuyViaKumbaya(address indexed buyer, uint256 charmWad, uint256 grossCl8y, uint8 payKind);
    event Cl8ySurplusToProtocol(uint256 amount);
    event EthRescued(address indexed to, uint256 amount);
    event Erc20Rescued(address indexed token, address indexed to, uint256 amount);

    /// @param stableToken_ Pass `address(0)` if only ETH (WETH) pay mode is allowed on this deployment.
    /// @param cl8yProtocolTreasury_ Non-zero sink for CL8Y left on the router after `buyFor` (no buyer refund of CL8Y).
    /// @param initialOwner_ Governance / ops account for **`rescue*`** + `Ownable2Step` lifecycle (typically same trust domain as `TimeCurve` owner).
    constructor(
        TimeCurve timeCurve_,
        address kumbayaRouter_,
        address weth_,
        address stableToken_,
        address cl8yProtocolTreasury_,
        address initialOwner_
    ) Ownable(initialOwner_) {
        if (cl8yProtocolTreasury_ == address(0)) revert TimeCurveBuyRouter__ZeroTreasury();
        timeCurve = timeCurve_;
        kumbayaRouter = IKumbayaSwapRouter(kumbayaRouter_);
        weth = IWETH(weth_);
        stableToken = IERC20(stableToken_);
        cl8yProtocolTreasury = cl8yProtocolTreasury_;
    }

    /// @dev `payKind`: **0** = ETH (`msg.value` wraps to WETH; path must end in WETH), **1** = `stableToken` (approve this router).
    uint8 public constant PAY_ETH = 0;
    uint8 public constant PAY_STABLE = 1;

    /// @notice `path` last token must be WETH for `PAY_ETH`, or `stableToken` for `PAY_STABLE`. First token must be TimeCurve accepted asset (CL8Y).
    /// @dev Reverts **`TimeCurveBuyRouter__BadSalePhase`** when the sale is unscheduled, ended, past **`deadline`**, or **scheduled but not yet live**
    ///      (`block.timestamp < saleStart()` after **`startSaleAt`** — GitLab #114 / #118), **before** path pricing, **`exactOutput`**, or **`buyFor`**.
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
        uint256 saleStart_ = tc.saleStart();
        if (saleStart_ == 0 || tc.ended() || block.timestamp < saleStart_ || block.timestamp >= tc.deadline()) {
            revert TimeCurveBuyRouter__BadSalePhase();
        }

        (uint256 minCharm, uint256 maxCharm) = tc.currentCharmBoundsWad();
        if (charmWad < minCharm || charmWad > maxCharm) revert TimeCurveBuyRouter__CharmBounds();

        uint256 grossCl8y = Math.mulDiv(charmWad, tc.currentPricePerCharmWad(), WAD);
        if (grossCl8y == 0) revert TimeCurveBuyRouter__BadSalePhase();

        address cl8y = address(tc.acceptedAsset());
        _validatePath(path, cl8y, payKind);

        IERC20 cl8yTok = IERC20(cl8y);
        uint256 cl8yBefore = cl8yTok.balanceOf(address(this));
        IERC20 wethErc = IERC20(address(weth));

        uint256 inputSnapshot;
        if (payKind == PAY_ETH) {
            if (msg.value == 0) revert TimeCurveBuyRouter__EthValue();
            inputSnapshot = wethErc.balanceOf(address(this));
            weth.deposit{value: msg.value}();
            wethErc.forceApprove(address(kumbayaRouter), amountInMaximum);
        } else {
            if (address(stableToken) == address(0)) revert TimeCurveBuyRouter__StableNotConfigured();
            inputSnapshot = stableToken.balanceOf(address(this));
            stableToken.safeTransferFrom(msg.sender, address(this), amountInMaximum);
            uint256 stableReceived = stableToken.balanceOf(address(this)) - inputSnapshot;
            if (stableReceived != amountInMaximum) revert TimeCurveBuyRouter__StableIngressParity();
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
            uint256 wethBal = weth.balanceOf(address(this));
            if (wethBal < inputSnapshot) revert TimeCurveBuyRouter__RefundInvariant();
            uint256 refundWeth = wethBal - inputSnapshot;
            if (refundWeth > 0) {
                weth.withdraw(refundWeth);
                (bool ok,) = payable(msg.sender).call{value: refundWeth}("");
                require(ok, "TimeCurveBuyRouter: eth refund");
            }
        } else {
            stableToken.forceApprove(address(kumbayaRouter), 0);
            uint256 stBal = stableToken.balanceOf(address(this));
            if (stBal < inputSnapshot) revert TimeCurveBuyRouter__RefundInvariant();
            uint256 refundStable = stBal - inputSnapshot;
            if (refundStable > 0) {
                stableToken.safeTransfer(msg.sender, refundStable);
            }
        }

        uint256 cl8yGain = cl8yTok.balanceOf(address(this)) - cl8yBefore;
        if (cl8yGain < grossCl8y) revert TimeCurveBuyRouter__BadSalePhase();

        cl8yTok.forceApprove(address(tc), grossCl8y);
        tc.buyFor(msg.sender, charmWad, codeHash, plantWarBowFlag);
        cl8yTok.forceApprove(address(tc), 0);

        uint256 dust = cl8yTok.balanceOf(address(this));
        if (dust > 0) {
            cl8yTok.safeTransfer(cl8yProtocolTreasury, dust);
            emit Cl8ySurplusToProtocol(dust);
        }

        emit BuyViaKumbaya(msg.sender, charmWad, grossCl8y, payKind);
    }

    receive() external payable {}

    /// @notice Native ETH accidentally sent to this contract (outside WETH withdrawals). **`amount == type(uint256).max`** means full balance.
    function rescueETH(address payable to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert TimeCurveBuyRouter__RescueZeroRecipient();
        uint256 bal = address(this).balance;
        uint256 send = amount == type(uint256).max ? bal : amount;
        if (send == 0) return;
        if (send > bal) revert TimeCurveBuyRouter__RescueExceedsBalance();
        (bool ok,) = to.call{value: send}("");
        require(ok, "TimeCurveBuyRouter: eth rescue");
        emit EthRescued(to, send);
    }

    /// @notice Sweep ERC20 stranded on this contract (includes WETH, stable, arbitrary tokens). **`amount == type(uint256).max`** means full balance.
    /// @dev Does not automatically forward CL8Y from active swaps (`buyViaKumbaya` still routes surplus to `cl8yProtocolTreasury`); this is ops recovery only.
    function rescueERC20(IERC20 token, address to, uint256 amount) external onlyOwner nonReentrant {
        if (address(token) == address(0)) revert TimeCurveBuyRouter__RescueZeroToken();
        if (to == address(0)) revert TimeCurveBuyRouter__RescueZeroRecipient();
        uint256 bal = token.balanceOf(address(this));
        uint256 send = amount == type(uint256).max ? bal : amount;
        if (send == 0) return;
        if (send > bal) revert TimeCurveBuyRouter__RescueExceedsBalance();
        token.safeTransfer(to, send);
        emit Erc20Rescued(address(token), to, send);
    }

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
