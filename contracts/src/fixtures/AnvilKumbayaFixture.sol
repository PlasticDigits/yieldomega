// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @dev Wrapped ETH for Anvil routing tests (issue #41).
contract AnvilWETH9 is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") {}

    receive() external payable {
        deposit();
    }

    function deposit() public payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 wad) external {
        _burn(msg.sender, wad);
        (bool ok, ) = payable(msg.sender).call{value: wad}("");
        require(ok, "WETH: withdraw");
    }
}

/// @dev Mintable USDM stand-in for Anvil.
contract AnvilMockUSDM is ERC20 {
    constructor() ERC20("USDM", "USDM") {
        _mint(msg.sender, 100_000_000e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @notice Anvil-only router + quoter: v3 `exactOutput` path encoding, constant-product hops.
 * @dev Each hop uses reserves keyed by (tokenIn, tokenOut). Not Uniswap v3 math.
 */
contract AnvilKumbayaRouter {
    using SafeERC20 for IERC20;

    uint256 internal constant FEE_NUM = 997;
    uint256 internal constant FEE_DEN = 1000;

    address public owner;
    mapping(address => mapping(address => uint112)) public reserveIn;
    mapping(address => mapping(address => uint112)) public reserveOut;

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

    /// @dev QuoterV2-compatible single-hop quote (frontend `kumbayaQuoter.ts` — GitLab #264).
    struct QuoteExactOutputSingleParams {
        address tokenIn;
        address tokenOut;
        uint256 amount;
        uint24 fee;
        uint160 sqrtPriceLimitX96;
    }

    function quoteExactOutputSingle(QuoteExactOutputSingleParams calldata params)
        external
        view
        returns (uint256 amountIn, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)
    {
        uint256 rIn = uint256(reserveIn[params.tokenIn][params.tokenOut]);
        uint256 rOut = uint256(reserveOut[params.tokenIn][params.tokenOut]);
        if (rIn == 0 || rOut == 0) revert BadPath();
        amountIn = getAmountIn(params.amount, rIn, rOut);
        return (amountIn, 0, 0, 200_000);
    }

    error Expired();
    error SlippageIn();
    error SlippageOut();
    error BadPath();
    error Unauthorized();

    constructor() {
        owner = msg.sender;
    }

    function setOwner(address next) external {
        if (msg.sender != owner) revert Unauthorized();
        owner = next;
    }

    function setPair(address tokenIn, address tokenOut, uint256 rIn, uint256 rOut) external {
        if (msg.sender != owner) revert Unauthorized();
        require(rIn <= type(uint112).max && rOut <= type(uint112).max);
        reserveIn[tokenIn][tokenOut] = uint112(uint256(rIn));
        reserveOut[tokenIn][tokenOut] = uint112(uint256(rOut));
    }

    function getAmountIn(uint256 amountOut, uint256 rIn, uint256 rOut) internal pure returns (uint256) {
        if (amountOut >= rOut) revert SlippageOut();
        return (rIn * amountOut * FEE_DEN) / ((rOut - amountOut) * FEE_NUM) + 1;
    }

    function hopCount(bytes memory path) internal pure returns (uint256 n) {
        if (path.length < 43) revert BadPath();
        if ((path.length - 20) % 23 != 0) revert BadPath();
        n = (path.length - 20) / 23;
    }

    function hopAddresses(bytes memory path, uint256 hopIndex) internal pure returns (address tokenOut, address tokenIn) {
        uint256 off = hopIndex * 23;
        require(path.length >= off + 43);
        assembly {
            tokenOut := shr(96, mload(add(add(path, 32), off)))
            tokenIn := shr(96, mload(add(add(path, 32), add(off, 23))))
        }
    }

    /// @dev QuoterV2-compatible signature (unused return arrays empty).
    function quoteExactOutput(bytes memory path, uint256 amountOut)
        external
        view
        returns (uint256 amountIn, uint160[] memory, uint32[] memory, uint256 gasEstimate)
    {
        uint256 n = hopCount(path);
        /// @dev Walk hops **from CL8Y/output end toward input** (hop 0 … n-1) so multi-hop `amountIn` matches `exactOutput`.
        uint256 amt = amountOut;
        for (uint256 hi = 0; hi < n; ++hi) {
            (address tokenOut, address tokenIn) = hopAddresses(path, hi);
            uint256 rIn = uint256(reserveIn[tokenIn][tokenOut]);
            uint256 rOut = uint256(reserveOut[tokenIn][tokenOut]);
            if (rIn == 0 || rOut == 0) revert BadPath();
            amt = getAmountIn(amt, rIn, rOut);
        }
        return (amt, new uint160[](0), new uint32[](0), 200_000);
    }

    function exactOutputSingle(ExactOutputSingleParams calldata params) external returns (uint256 amountIn) {
        bytes memory path = abi.encodePacked(params.tokenOut, params.fee, params.tokenIn);
        return _exactOutput(path, params.recipient, params.amountOut, params.amountInMaximum);
    }

    function exactOutput(ExactOutputParams calldata params) external returns (uint256 amountIn) {
        return _exactOutput(params.path, params.recipient, params.amountOut, params.amountInMaximum);
    }

    function _exactOutput(bytes memory path, address recipient, uint256 amountOut, uint256 amountInMaximum)
        internal
        returns (uint256 amountIn)
    {
        uint256 n = hopCount(path);

        uint256 curOut = amountOut;
        uint256[] memory needOut = new uint256[](n);
        for (uint256 hi = 0; hi < n; ++hi) {
            needOut[hi] = curOut;
            (address tokenOut, address tokenIn) = hopAddresses(path, hi);
            uint256 rIn = uint256(reserveIn[tokenIn][tokenOut]);
            uint256 rOut = uint256(reserveOut[tokenIn][tokenOut]);
            if (rIn == 0 || rOut == 0) revert BadPath();
            curOut = getAmountIn(curOut, rIn, rOut);
        }
        amountIn = curOut;
        if (amountIn > amountInMaximum) revert SlippageIn();

        for (uint256 h = n; h > 0; h--) {
            uint256 hi = h - 1;
            (address tOut, address tIn) = hopAddresses(path, hi);
            uint256 outAmt = needOut[hi];
            uint256 rIn = uint256(reserveIn[tIn][tOut]);
            uint256 rOut = uint256(reserveOut[tIn][tOut]);
            uint256 inAmt = getAmountIn(outAmt, rIn, rOut);

            if (hi == n - 1) {
                IERC20(tIn).safeTransferFrom(msg.sender, address(this), inAmt);
            }

            uint112 newIn = uint112(rIn + inAmt);
            uint112 newOut = uint112(rOut - outAmt);
            reserveIn[tIn][tOut] = newIn;
            reserveOut[tIn][tOut] = newOut;

            address dest = hi == 0 ? recipient : address(this);
            IERC20(tOut).safeTransfer(dest, outAmt);
        }
    }
}
