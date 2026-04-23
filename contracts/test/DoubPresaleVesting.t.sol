// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {DoubPresaleVesting} from "../src/vesting/DoubPresaleVesting.sol";
import {UUPSDeployLib} from "../script/UUPSDeployLib.sol";

contract MockDoub is ERC20 {
    constructor() ERC20("Doubloon", "DOUB") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract DoubPresaleVestingTest is Test {
    MockDoub internal doub;
    uint256 internal constant DURATION = 180 days;
    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    function _deployVesting(address[] memory ben, uint256[] memory amts, uint256 requiredTotal)
        internal
        returns (DoubPresaleVesting v)
    {
        v = UUPSDeployLib.deployDoubPresaleVesting(IERC20(address(doub)), owner, ben, amts, requiredTotal, DURATION);
    }

    function _expectVestingInitRevert(bytes memory initData, bytes memory expectedRevert) internal {
        DoubPresaleVesting impl = new DoubPresaleVesting();
        vm.expectRevert(expectedRevert);
        new ERC1967Proxy(address(impl), initData);
    }

    function setUp() public {
        doub = new MockDoub();
    }

    function test_constructor_reverts_totalMismatch() public {
        address[] memory ben = new address[](2);
        ben[0] = alice;
        ben[1] = bob;
        uint256[] memory amts = new uint256[](2);
        amts[0] = 100e18;
        amts[1] = 50e18;
        _expectVestingInitRevert(
            abi.encodeCall(DoubPresaleVesting.initialize, (IERC20(address(doub)), owner, ben, amts, 200e18, DURATION)),
            abi.encodeWithSelector(DoubPresaleVesting.DoubVesting__TotalMismatch.selector, 150e18, 200e18)
        );
    }

    function test_constructor_reverts_duplicateBeneficiary() public {
        address[] memory ben = new address[](2);
        ben[0] = alice;
        ben[1] = alice;
        uint256[] memory amts = new uint256[](2);
        amts[0] = 50e18;
        amts[1] = 50e18;
        _expectVestingInitRevert(
            abi.encodeCall(DoubPresaleVesting.initialize, (IERC20(address(doub)), owner, ben, amts, 100e18, DURATION)),
            abi.encodeWithSelector(DoubPresaleVesting.DoubVesting__DuplicateBeneficiary.selector, alice)
        );
    }

    function test_constructor_reverts_zeroBeneficiary() public {
        address[] memory ben = new address[](1);
        ben[0] = address(0);
        uint256[] memory amts = new uint256[](1);
        amts[0] = 1e18;
        _expectVestingInitRevert(
            abi.encodeCall(DoubPresaleVesting.initialize, (IERC20(address(doub)), owner, ben, amts, 1e18, DURATION)),
            abi.encodeWithSelector(DoubPresaleVesting.DoubVesting__ZeroBeneficiary.selector)
        );
    }

    function test_constructor_reverts_zeroAllocation() public {
        address[] memory ben = new address[](1);
        ben[0] = alice;
        uint256[] memory amts = new uint256[](1);
        amts[0] = 0;
        _expectVestingInitRevert(
            abi.encodeCall(DoubPresaleVesting.initialize, (IERC20(address(doub)), owner, ben, amts, 1e18, DURATION)),
            abi.encodeWithSelector(DoubPresaleVesting.DoubVesting__ZeroAllocation.selector)
        );
    }

    function test_constructor_reverts_lengthMismatch() public {
        address[] memory ben = new address[](1);
        ben[0] = alice;
        uint256[] memory amts = new uint256[](2);
        amts[0] = 1e18;
        amts[1] = 1e18;
        _expectVestingInitRevert(
            abi.encodeCall(DoubPresaleVesting.initialize, (IERC20(address(doub)), owner, ben, amts, 2e18, DURATION)),
            abi.encodeWithSelector(DoubPresaleVesting.DoubVesting__ArrayLengthMismatch.selector)
        );
    }

    function test_constructor_reverts_zeroDuration() public {
        address[] memory ben = new address[](1);
        ben[0] = alice;
        uint256[] memory amts = new uint256[](1);
        amts[0] = 1e18;
        _expectVestingInitRevert(
            abi.encodeCall(DoubPresaleVesting.initialize, (IERC20(address(doub)), owner, ben, amts, 1e18, 0)),
            abi.encodeWithSelector(DoubPresaleVesting.DoubVesting__ZeroDuration.selector)
        );
    }

    function test_constructor_reverts_zeroToken() public {
        address[] memory ben = new address[](1);
        ben[0] = alice;
        uint256[] memory amts = new uint256[](1);
        amts[0] = 1e18;
        _expectVestingInitRevert(
            abi.encodeCall(DoubPresaleVesting.initialize, (IERC20(address(0)), owner, ben, amts, 1e18, DURATION)),
            abi.encodeWithSelector(DoubPresaleVesting.DoubVesting__ZeroToken.selector)
        );
    }

    function test_startVesting_underfunded_reverts() public {
        address[] memory ben = new address[](1);
        ben[0] = alice;
        uint256[] memory amts = new uint256[](1);
        amts[0] = 100e18;
        DoubPresaleVesting v = _deployVesting(ben, amts, 100e18);
        doub.mint(address(v), 99e18);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(DoubPresaleVesting.DoubVesting__Underfunded.selector, 99e18, 100e18));
        v.startVesting();
    }

    function test_startVesting_twice_reverts() public {
        address[] memory ben = new address[](1);
        ben[0] = alice;
        uint256[] memory amts = new uint256[](1);
        amts[0] = 100e18;
        DoubPresaleVesting v = _deployVesting(ben, amts, 100e18);
        doub.mint(address(v), 100e18);
        vm.startPrank(owner);
        v.startVesting();
        vm.expectRevert(DoubPresaleVesting.DoubVesting__AlreadyStarted.selector);
        v.startVesting();
        vm.stopPrank();
    }

    function test_claim_beforeStart_reverts() public {
        address[] memory ben = new address[](1);
        ben[0] = alice;
        uint256[] memory amts = new uint256[](1);
        amts[0] = 100e18;
        DoubPresaleVesting v = _deployVesting(ben, amts, 100e18);
        doub.mint(address(v), 100e18);
        vm.prank(alice);
        vm.expectRevert(DoubPresaleVesting.DoubVesting__NotStarted.selector);
        v.claim();
    }

    function test_claim_nonBeneficiary_reverts() public {
        address[] memory ben = new address[](1);
        ben[0] = alice;
        uint256[] memory amts = new uint256[](1);
        amts[0] = 100e18;
        DoubPresaleVesting v = _deployVesting(ben, amts, 100e18);
        doub.mint(address(v), 100e18);
        vm.prank(owner);
        v.startVesting();
        vm.prank(bob);
        vm.expectRevert(DoubPresaleVesting.DoubVesting__NotBeneficiary.selector);
        v.claim();
    }

    function test_vestedAt_cliff_is_30_percent() public {
        address[] memory ben = new address[](1);
        ben[0] = alice;
        uint256[] memory amts = new uint256[](1);
        amts[0] = 1000e18;
        DoubPresaleVesting v = _deployVesting(ben, amts, 1000e18);
        doub.mint(address(v), 1000e18);
        vm.prank(owner);
        v.startVesting();
        uint256 t0 = block.timestamp;
        assertEq(v.vestedAt(alice, t0), 300e18, "30% at start");
        assertEq(v.claimableAt(alice, t0), 300e18);
    }

    function test_vestedAt_mid_linear() public {
        address[] memory ben = new address[](1);
        ben[0] = alice;
        uint256[] memory amts = new uint256[](1);
        amts[0] = 1000e18;
        DoubPresaleVesting v = _deployVesting(ben, amts, 1000e18);
        doub.mint(address(v), 1000e18);
        vm.prank(owner);
        v.startVesting();
        uint256 half = DURATION / 2;
        vm.warp(block.timestamp + half);
        // cliff 300 + half of linear (700) = 300 + 350 = 650
        assertEq(v.vestedAt(alice, block.timestamp), 650e18);
    }

    function test_vestedAt_end_is_full_allocation() public {
        address[] memory ben = new address[](1);
        ben[0] = alice;
        uint256[] memory amts = new uint256[](1);
        uint256 alloc = 777e18;
        amts[0] = alloc;
        DoubPresaleVesting v = _deployVesting(ben, amts, alloc);
        doub.mint(address(v), alloc);
        vm.prank(owner);
        v.startVesting();
        vm.warp(block.timestamp + DURATION);
        assertEq(v.vestedAt(alice, block.timestamp), alloc);
        vm.warp(block.timestamp + 365 days);
        assertEq(v.vestedAt(alice, block.timestamp), alloc);
    }

    function test_claim_full_lifecycle() public {
        address[] memory ben = new address[](2);
        ben[0] = alice;
        ben[1] = bob;
        uint256[] memory amts = new uint256[](2);
        amts[0] = 1000e18;
        amts[1] = 500e18;
        uint256 total = 1500e18;
        DoubPresaleVesting v = _deployVesting(ben, amts, total);
        doub.mint(address(v), total);
        vm.prank(owner);
        v.startVesting();

        vm.prank(alice);
        v.claim();
        assertEq(doub.balanceOf(alice), 300e18);

        vm.warp(block.timestamp + DURATION);

        vm.prank(alice);
        v.claim();
        assertEq(doub.balanceOf(alice), 1000e18);

        vm.prank(bob);
        v.claim();
        assertEq(doub.balanceOf(bob), 500e18);

        assertEq(doub.balanceOf(address(v)), 0);
    }

    function test_enumeration_contains_all() public {
        address[] memory ben = new address[](3);
        ben[0] = alice;
        ben[1] = bob;
        ben[2] = carol;
        uint256[] memory amts = new uint256[](3);
        amts[0] = 1e18;
        amts[1] = 2e18;
        amts[2] = 3e18;
        DoubPresaleVesting v = _deployVesting(ben, amts, 6e18);
        assertEq(v.beneficiaryCount(), 3);
        assertTrue(v.isBeneficiary(alice));
        assertTrue(v.isBeneficiary(bob));
        assertTrue(v.isBeneficiary(carol));
        // All three appear in enumeration
        address b0 = v.beneficiaryAt(0);
        address b1 = v.beneficiaryAt(1);
        address b2 = v.beneficiaryAt(2);
        assertTrue(b0 == alice || b0 == bob || b0 == carol);
        assertTrue(b1 == alice || b1 == bob || b1 == carol);
        assertTrue(b2 == alice || b2 == bob || b2 == carol);
        assertTrue(b0 != b1 && b1 != b2 && b0 != b2);
    }

    function test_claim_nothing_reverts() public {
        address[] memory ben = new address[](1);
        ben[0] = alice;
        uint256[] memory amts = new uint256[](1);
        amts[0] = 100e18;
        DoubPresaleVesting v = _deployVesting(ben, amts, 100e18);
        doub.mint(address(v), 100e18);
        vm.prank(owner);
        v.startVesting();
        vm.prank(alice);
        v.claim();
        vm.prank(alice);
        vm.expectRevert(DoubPresaleVesting.DoubVesting__NothingToClaim.selector);
        v.claim();
    }

    /// @dev Invariant: vested non-decreasing in `t` for any fixed beneficiary.
    function test_fuzz_vested_monotonic(uint128 allocRaw, uint256 t1Raw, uint256 t2Raw) public {
        uint256 alloc = bound(uint256(allocRaw), 1, type(uint128).max);
        address[] memory ben = new address[](1);
        ben[0] = alice;
        uint256[] memory amts = new uint256[](1);
        amts[0] = alloc;
        DoubPresaleVesting v = _deployVesting(ben, amts, alloc);
        doub.mint(address(v), alloc);
        vm.prank(owner);
        v.startVesting();
        uint256 start = block.timestamp;
        uint256 t1 = bound(t1Raw, start, start + 10 * DURATION);
        uint256 t2 = bound(t2Raw, start, start + 10 * DURATION);
        uint256 ta = t1 < t2 ? t1 : t2;
        uint256 tb = t1 < t2 ? t2 : t1;
        assertLe(v.vestedAt(alice, ta), v.vestedAt(alice, tb));
    }

    /// @dev Invariant: vested never exceeds allocation.
    function test_fuzz_vested_lte_allocation(uint128 allocRaw, uint256 tRaw) public {
        uint256 alloc = bound(uint256(allocRaw), 1, type(uint128).max);
        address[] memory ben = new address[](1);
        ben[0] = alice;
        uint256[] memory amts = new uint256[](1);
        amts[0] = alloc;
        DoubPresaleVesting v = _deployVesting(ben, amts, alloc);
        doub.mint(address(v), alloc);
        vm.prank(owner);
        v.startVesting();
        uint256 start = block.timestamp;
        uint256 t = bound(tRaw, 0, start + 100 * DURATION);
        assertLe(v.vestedAt(alice, t), alloc);
    }

    /// @dev Invariant: after arbitrary claim sequence, cumulative claimed <= allocation and contract balance matches remainder.
    function test_fuzz_multi_claim_bounded(uint128 a0, uint128 a1, uint128 a2, uint256 warpSeed) public {
        uint256 x0 = bound(uint256(a0), 1, 1e24);
        uint256 x1 = bound(uint256(a1), 1, 1e24);
        uint256 x2 = bound(uint256(a2), 1, 1e24);
        uint256 tot = x0 + x1 + x2;

        address[] memory ben = new address[](3);
        ben[0] = alice;
        ben[1] = bob;
        ben[2] = carol;
        uint256[] memory amts = new uint256[](3);
        amts[0] = x0;
        amts[1] = x1;
        amts[2] = x2;

        DoubPresaleVesting v = _deployVesting(ben, amts, tot);
        doub.mint(address(v), tot);
        vm.prank(owner);
        v.startVesting();

        uint256 w = bound(warpSeed, 0, DURATION * 3);
        vm.warp(block.timestamp + w);

        address[3] memory users = [alice, bob, carol];
        uint256[3] memory allocs = [x0, x1, x2];
        for (uint256 i; i < 3; ++i) {
            vm.prank(users[i]);
            try v.claim() {} catch {}
        }
        vm.warp(block.timestamp + DURATION * 2);
        for (uint256 j; j < 3; ++j) {
            vm.prank(users[j]);
            try v.claim() {} catch {}
        }

        for (uint256 k; k < 3; ++k) {
            assertLe(v.claimedOf(users[k]), allocs[k]);
        }
        uint256 sumClaimed = v.claimedOf(alice) + v.claimedOf(bob) + v.claimedOf(carol);
        assertEq(doub.balanceOf(address(v)) + sumClaimed, tot);
    }

    /// @dev Canonical presale total from docs: 21_500_000 DOUB split across arbitrary many wallets.
    function test_canonical_presale_total_accepted() public {
        uint256 presale = 21_500_000e18;
        address[] memory ben = new address[](2);
        ben[0] = alice;
        ben[1] = bob;
        uint256[] memory amts = new uint256[](2);
        amts[0] = 10_000_000e18;
        amts[1] = 11_500_000e18;
        DoubPresaleVesting v = UUPSDeployLib.deployDoubPresaleVesting(IERC20(address(doub)), owner, ben, amts, presale, DURATION);
        assertEq(v.totalAllocated(), presale);
        doub.mint(address(v), presale);
        vm.prank(owner);
        v.startVesting();
    }
}
