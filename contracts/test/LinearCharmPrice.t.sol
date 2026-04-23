// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {LinearCharmPrice} from "../src/pricing/LinearCharmPrice.sol";
import {UUPSDeployLib} from "../script/UUPSDeployLib.sol";

/// @notice Maps to **Linear price schedule** in [docs/testing/invariants-and-business-logic.md](../../docs/testing/invariants-and-business-logic.md).
contract LinearCharmPriceTest is Test {
    uint256 internal constant ONE_DAY = 86_400;

    /// @dev `priceWad = base + dailyIncrement * elapsed / 86400` for arbitrary elapsed (fuzz).
    function test_priceWad_linear_matches_formula_fuzz(uint40 elapsedSec) public {
        uint256 base = 1e18;
        uint256 daily = 1e17;
        LinearCharmPrice p = UUPSDeployLib.deployLinearCharmPrice(base, daily, address(this));
        uint256 elapsed = uint256(elapsedSec);
        assertEq(p.priceWad(elapsed), base + (daily * elapsed) / ONE_DAY);
    }

    /// @dev Price is non-decreasing in elapsed time.
    function test_priceWad_monotonic_in_elapsed_fuzz(uint32 a, uint32 b) public {
        LinearCharmPrice p = UUPSDeployLib.deployLinearCharmPrice(1e18, 1e17, address(this));
        uint256 t1 = uint256(a) % (10 * ONE_DAY);
        uint256 t2 = uint256(b) % (10 * ONE_DAY);
        if (t1 > t2) (t1, t2) = (t2, t1);
        assertLe(p.priceWad(t1), p.priceWad(t2));
    }

    function test_constructor_zero_base_reverts() public {
        LinearCharmPrice impl = new LinearCharmPrice();
        vm.expectRevert(abi.encodeWithSignature("Error(string)", "LinearCharmPrice: zero base"));
        new ERC1967Proxy(address(impl), abi.encodeCall(LinearCharmPrice.initialize, (0, 1, address(this))));
    }
}
