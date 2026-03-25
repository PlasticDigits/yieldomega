// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TimeCurve} from "../src/TimeCurve.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {PrizeVault} from "../src/sinks/PrizeVault.sol";

contract MockTokTC is ERC20 {
    constructor() ERC20("USDM", "USDM") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Random buys + small time warps while sale active (flat min-buy curve).
contract TimeCurveHandler is Test {
    TimeCurve public immutable tc;
    MockTokTC public immutable usdm;
    address public immutable alice;

    uint256 public ghost_buyVolume;

    constructor(TimeCurve _tc, MockTokTC _usdm, address _alice) {
        tc = _tc;
        usdm = _usdm;
        alice = _alice;
    }

    function buyBounded(uint256 seed) external {
        if (tc.saleStart() == 0 || tc.ended()) return;
        uint256 minB = tc.currentMinBuyAmount();
        uint256 maxB = minB * tc.purchaseCapMultiple();
        if (maxB < minB || minB == 0) return;
        uint256 amt = bound(seed, minB, maxB);
        usdm.mint(alice, amt);
        vm.prank(alice);
        usdm.approve(address(tc), amt);
        vm.prank(alice);
        tc.buy(amt);
        ghost_buyVolume += amt;
    }

    function tickTime(uint256 dt) external {
        if (tc.saleStart() == 0 || tc.ended()) return;
        dt = bound(dt, 1, 120);
        vm.warp(block.timestamp + dt);
    }
}

contract TimeCurveInvariantTest is Test {
    uint256 internal constant ONE_DAY = 86_400;

    MockTokTC internal usdm;
    MockTokTC internal launched;
    FeeRouter internal router;
    PrizeVault internal prizeVault;
    TimeCurve internal tc;
    TimeCurveHandler internal handler;

    address internal alice = makeAddr("tc_inv_alice");
    address internal s0 = makeAddr("tc_s0");
    address internal s1 = makeAddr("tc_s1");
    address internal s2;
    address internal s3 = makeAddr("tc_s3");

    function setUp() public {
        usdm = new MockTokTC();
        launched = new MockTokTC();
        prizeVault = new PrizeVault(address(this));
        s2 = address(prizeVault);
        router = new FeeRouter(
            address(this),
            [s0, s1, s2, s3],
            [uint16(3000), uint16(2000), uint16(3500), uint16(1500)]
        );
        tc = new TimeCurve(
            IERC20(address(usdm)),
            IERC20(address(launched)),
            router,
            prizeVault,
            address(0),
            1e18,
            0,
            10,
            60,
            ONE_DAY,
            ONE_DAY,
            1_000_000e18,
            3600,
            3600
        );
        prizeVault.grantRole(prizeVault.DISTRIBUTOR_ROLE(), address(tc));
        launched.mint(address(tc), 1_000_000e18);
        tc.startSale();
        handler = new TimeCurveHandler(tc, usdm, alice);
        targetContract(address(handler));
    }

    function invariant_timeCurve_totalRaisedMatchesGhostBuys() public view {
        assertEq(tc.totalRaised(), handler.ghost_buyVolume(), "totalRaised");
    }

    function invariant_timeCurve_charmWeightLteTotalRaised() public view {
        assertLe(tc.charmWeight(alice), tc.totalRaised(), "charmWeight");
    }
}
