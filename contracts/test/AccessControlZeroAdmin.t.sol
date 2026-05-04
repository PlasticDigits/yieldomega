// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CL8YProtocolTreasury} from "../src/sinks/CL8YProtocolTreasury.sol";
import {DoubLPIncentives} from "../src/sinks/DoubLPIncentives.sol";
import {EcosystemTreasury} from "../src/sinks/EcosystemTreasury.sol";
import {PodiumPool} from "../src/sinks/PodiumPool.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {RabbitTreasury} from "../src/RabbitTreasury.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {LeprechaunNFT} from "../src/LeprechaunNFT.sol";
import {UUPSDeployLib} from "../script/UUPSDeployLib.sol";

contract MockReserve is ERC20 {
    constructor() ERC20("CL8Y", "CL8Y") {}
}

/// @dev GitLab #120 / audit L-03: AccessControl initializers must reject `admin == address(0)` before any
///      `_grantRole` that would assign `DEFAULT_ADMIN_ROLE` (and co-granted roles in the same block).
contract AccessControlZeroAdminTest is Test {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant ONE_DAY = 86_400;

    // BurrowMath-shaped defaults (minimal valid RabbitTreasury init)
    uint256 internal constant C_MAX = 2e18;
    uint256 internal constant C_STAR = 1_050_000_000_000_000_000;
    uint256 internal constant ALPHA = 2e16;
    uint256 internal constant BETA = 2e18;
    uint256 internal constant M_MIN = 98e16;
    uint256 internal constant M_MAX = 102e16;
    uint256 internal constant LAM = 5e17;
    uint256 internal constant DELTA_MAX_FRAC = 2e16;
    uint256 internal constant EPS = 1;

    address internal sink0 = makeAddr("z0");
    address internal sink1 = makeAddr("z1");
    address internal sink2 = makeAddr("z2");
    address internal sink3 = makeAddr("z3");
    address internal sink4 = makeAddr("z4");
    uint16[5] internal weights = [uint16(3000), uint16(4000), uint16(2000), uint16(0), uint16(1000)];

    function test_CL8YProtocolTreasury_zeroAdmin_reverts() public {
        CL8YProtocolTreasury impl = new CL8YProtocolTreasury();
        bytes memory data = abi.encodeCall(CL8YProtocolTreasury.initialize, (address(0)));
        vm.expectRevert("FeeSink: zero admin");
        new ERC1967Proxy(address(impl), data);
    }

    function test_DoubLPIncentives_zeroAdmin_reverts() public {
        DoubLPIncentives impl = new DoubLPIncentives();
        bytes memory data = abi.encodeCall(DoubLPIncentives.initialize, (address(0)));
        vm.expectRevert("FeeSink: zero admin");
        new ERC1967Proxy(address(impl), data);
    }

    function test_EcosystemTreasury_zeroAdmin_reverts() public {
        EcosystemTreasury impl = new EcosystemTreasury();
        bytes memory data = abi.encodeCall(EcosystemTreasury.initialize, (address(0)));
        vm.expectRevert("FeeSink: zero admin");
        new ERC1967Proxy(address(impl), data);
    }

    function test_PodiumPool_zeroAdmin_reverts() public {
        PodiumPool impl = new PodiumPool();
        bytes memory data = abi.encodeCall(PodiumPool.initialize, (address(0)));
        vm.expectRevert("PodiumPool: zero admin");
        new ERC1967Proxy(address(impl), data);
    }

    /// @dev `FeeRouter.initialize` checks admin **before** `_setSinks` so a zero admin reverts with
    ///      `FeeRouter: zero admin`, not sink validation (`FeeRouter: zero address` / `FeeMath: ...`).
    function test_FeeRouter_zeroAdmin_reverts_before_sink_validation() public {
        FeeRouter impl = new FeeRouter();
        bytes memory data = abi.encodeWithSelector(
            FeeRouter.initialize.selector,
            address(0),
            [sink0, sink1, sink2, sink3, sink4],
            weights
        );
        vm.expectRevert("FeeRouter: zero admin");
        new ERC1967Proxy(address(impl), data);
    }

    /// @dev `vm.expectRevert` pairs with the next **call** boundary. Inline `new ERC1967Proxy` from an
    ///      internal library path may not surface as expected; delegate via `this.` external call.
    function test_RabbitTreasury_zeroAdmin_reverts() public {
        MockReserve reserve = new MockReserve();
        Doubloon doub = new Doubloon(address(this));
        vm.expectRevert("RT: zero admin");
        this.externDeployRabbitTreasuryZeroAdmin(IERC20(address(reserve)), doub);
    }

    function externDeployRabbitTreasuryZeroAdmin(IERC20 reserve, Doubloon doub) external {
        UUPSDeployLib.deployRabbitTreasury(
            reserve,
            doub,
            ONE_DAY,
            C_MAX,
            C_STAR,
            ALPHA,
            BETA,
            M_MIN,
            M_MAX,
            LAM,
            DELTA_MAX_FRAC,
            EPS,
            25e16,
            1e16,
            5e17,
            0,
            address(0),
            address(0)
        );
    }

    function test_Doubloon_zeroAdmin_reverts() public {
        vm.expectRevert("Doubloon: zero admin");
        new Doubloon(address(0));
    }

    function test_LeprechaunNFT_zeroAdmin_reverts() public {
        vm.expectRevert("LeprechaunNFT: zero admin");
        new LeprechaunNFT("Leprechaun", "LEP", "https://example.com/", address(0));
    }
}
