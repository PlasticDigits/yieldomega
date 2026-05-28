// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

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

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/// @notice Holds the admin share of each buy (30% of DOUB paid).
contract AdminSellVault is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable doub;
    address public arena;
    IKumbayaExactInputSingle public swapRouter;
    IERC20 public usdm;
    uint24 public swapFee;
    address public adminAccount;

    event AdminVaultFunded(uint256 amount);
    event DoubSoldToUsdm(uint256 doubIn, uint256 usdmOut, address indexed recipient);

    constructor(IERC20 doubToken, address owner_) Ownable(owner_) {
        require(address(doubToken) != address(0), "AdminSellVault: zero doub");
        doub = doubToken;
        adminAccount = owner_;
    }

    function setArena(address arena_) external onlyOwner {
        require(arena_ != address(0), "AdminSellVault: zero arena");
        arena = arena_;
    }

    function setSwapConfig(address router, address usdm_, uint24 fee, address admin) external onlyOwner {
        swapRouter = IKumbayaExactInputSingle(router);
        usdm = IERC20(usdm_);
        swapFee = fee;
        if (admin != address(0)) adminAccount = admin;
    }

    function notifyFunded(uint256 amount) external {
        require(msg.sender == arena, "AdminSellVault: not arena");
        emit AdminVaultFunded(amount);
    }

    function sellDoubToUsdm(uint256 minOut) external onlyOwner {
        require(address(swapRouter) != address(0) && address(usdm) != address(0), "AdminSellVault: no swap");
        uint256 bal = doub.balanceOf(address(this));
        require(bal > 0, "AdminSellVault: empty");
        doub.forceApprove(address(swapRouter), bal);
        uint256 out = swapRouter.exactInputSingle(
            IKumbayaExactInputSingle.ExactInputSingleParams({
                tokenIn: address(doub),
                tokenOut: address(usdm),
                fee: swapFee,
                recipient: adminAccount,
                amountIn: bal,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            })
        );
        require(out >= minOut, "AdminSellVault: slippage");
        emit DoubSoldToUsdm(bal, out, adminAccount);
    }

    function rescueDoub(address to, uint256 amount) external onlyOwner {
        doub.safeTransfer(to, amount);
    }
}
