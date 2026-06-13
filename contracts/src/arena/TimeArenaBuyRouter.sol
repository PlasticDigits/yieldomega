// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {TimeArena} from "./TimeArena.sol";

interface IWETH is IERC20 {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
}

interface IKumbayaV3SwapRouter {
    struct ExactOutputParams {
        bytes path;
        address recipient;
        uint256 amountOut;
        uint256 amountInMaximum;
    }

    struct ExactOutputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountOut;
        uint256 amountInMaximum;
        uint160 sqrtPriceLimitX96;
    }

    function exactOutput(ExactOutputParams calldata params) external payable returns (uint256 amountIn);
    function exactOutputSingle(ExactOutputSingleParams calldata params) external payable returns (uint256 amountIn);
}

/// @title TimeArenaBuyRouter — ETH / stable / CL8Y → DOUB → `TimeArena.buyFor` (#251).
contract TimeArenaBuyRouter is ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;

    TimeArena public immutable timeArena;
    IKumbayaV3SwapRouter public immutable kumbayaRouter;
    IERC20 public immutable doub;
    IERC20 public immutable cl8y;
    IWETH public immutable weth;
    IERC20 public immutable stableToken;
    address public immutable doubSurplusRecipient;

    uint256 internal constant WAD = 1e18;
    uint8 public constant PAY_ETH = 0;
    uint8 public constant PAY_STABLE = 1;
    uint8 public constant PAY_CL8Y = 2;

    error TimeArenaBuyRouter__BadPhase();
    error TimeArenaBuyRouter__BadPath();
    error TimeArenaBuyRouter__CharmBounds();
    error TimeArenaBuyRouter__StableNotConfigured();
    error TimeArenaBuyRouter__StableIngressParity();
    error TimeArenaBuyRouter__SwapExpired();
    error TimeArenaBuyRouter__ZeroRecipient();

    event BuyViaKumbaya(address indexed buyer, uint256 charmWad, uint256 grossDoub, uint8 payKind);

    constructor(
        TimeArena timeArena_,
        address kumbayaRouter_,
        address doub_,
        address cl8y_,
        address weth_,
        address stableToken_,
        address doubSurplusRecipient_,
        address initialOwner_
    ) Ownable(initialOwner_) {
        if (doubSurplusRecipient_ == address(0)) revert TimeArenaBuyRouter__ZeroRecipient();
        timeArena = timeArena_;
        kumbayaRouter = IKumbayaV3SwapRouter(kumbayaRouter_);
        doub = IERC20(doub_);
        cl8y = IERC20(cl8y_);
        weth = IWETH(weth_);
        stableToken = IERC20(stableToken_);
        doubSurplusRecipient = doubSurplusRecipient_;
    }

    function buyViaKumbaya(
        uint256 charmWad,
        bytes32 codeHash,
        bool plantWarBowFlag,
        uint8 payKind,
        uint256 swapDeadline,
        uint256 amountInMaximum,
        bytes calldata path
    ) external payable nonReentrant {
        TimeArena ta = timeArena;
        if (ta.arenaStart() == 0 || ta.paused()) {
            revert TimeArenaBuyRouter__BadPhase();
        }
        if (charmWad < 99e16 || charmWad > 10e18) revert TimeArenaBuyRouter__CharmBounds();

        uint256 grossDoub = ta.doubOwedForBuy(charmWad);
        if (grossDoub == 0) revert TimeArenaBuyRouter__BadPhase();
        if (block.timestamp > swapDeadline) revert TimeArenaBuyRouter__SwapExpired();

        _validatePath(path, payKind);
        uint256 doubBefore = doub.balanceOf(address(this));

        if (payKind == PAY_CL8Y) {
            cl8y.safeTransferFrom(msg.sender, address(this), amountInMaximum);
            cl8y.forceApprove(address(kumbayaRouter), amountInMaximum);
        } else if (payKind == PAY_ETH) {
            weth.deposit{value: msg.value}();
            IERC20(address(weth)).forceApprove(address(kumbayaRouter), amountInMaximum);
        } else {
            if (address(stableToken) == address(0)) revert TimeArenaBuyRouter__StableNotConfigured();
            uint256 snap = stableToken.balanceOf(address(this));
            stableToken.safeTransferFrom(msg.sender, address(this), amountInMaximum);
            if (stableToken.balanceOf(address(this)) - snap != amountInMaximum) {
                revert TimeArenaBuyRouter__StableIngressParity();
            }
            stableToken.forceApprove(address(kumbayaRouter), amountInMaximum);
        }

        _swapExactOut(path, grossDoub, amountInMaximum);

        uint256 gained = doub.balanceOf(address(this)) - doubBefore;
        if (gained < grossDoub) revert TimeArenaBuyRouter__BadPhase();

        doub.forceApprove(address(ta), grossDoub);
        ta.buyFor(msg.sender, charmWad, codeHash, plantWarBowFlag);
        doub.forceApprove(address(ta), 0);

        uint256 dust = doub.balanceOf(address(this));
        if (dust > 0) {
            doub.safeTransfer(doubSurplusRecipient, dust);
        }

        emit BuyViaKumbaya(msg.sender, charmWad, grossDoub, payKind);
    }

    receive() external payable {}

    function _swapExactOut(bytes calldata path, uint256 grossDoub, uint256 amountInMaximum) internal {
        if (path.length == 43) {
            address tokenIn;
            uint24 fee;
            assembly {
                fee := shr(232, calldataload(add(path.offset, 20)))
                tokenIn := shr(96, calldataload(add(path.offset, 23)))
            }
            kumbayaRouter.exactOutputSingle(
                IKumbayaV3SwapRouter.ExactOutputSingleParams({
                    tokenIn: tokenIn,
                    tokenOut: address(doub),
                    fee: fee,
                    recipient: address(this),
                    amountOut: grossDoub,
                    amountInMaximum: amountInMaximum,
                    sqrtPriceLimitX96: 0
                })
            );
            return;
        }
        kumbayaRouter.exactOutput(
            IKumbayaV3SwapRouter.ExactOutputParams({
                path: path,
                recipient: address(this),
                amountOut: grossDoub,
                amountInMaximum: amountInMaximum
            })
        );
    }

    function _validatePath(bytes calldata path, uint8 payKind) internal view {
        if (path.length < 43 || (path.length - 20) % 23 != 0) revert TimeArenaBuyRouter__BadPath();
        address first;
        assembly {
            first := shr(96, calldataload(path.offset))
        }
        if (first != address(doub)) revert TimeArenaBuyRouter__BadPath();
        address last;
        unchecked {
            uint256 off = path.length - 20;
            assembly {
                last := shr(96, calldataload(add(path.offset, off)))
            }
        }
        if (payKind == PAY_CL8Y) {
            if (last != address(cl8y)) revert TimeArenaBuyRouter__BadPath();
        } else if (payKind == PAY_ETH) {
            if (last != address(weth)) revert TimeArenaBuyRouter__BadPath();
        } else if (payKind == PAY_STABLE) {
            if (last != address(stableToken)) revert TimeArenaBuyRouter__BadPath();
        } else {
            revert TimeArenaBuyRouter__BadPath();
        }
    }
}
