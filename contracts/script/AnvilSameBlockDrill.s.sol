// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TimeCurve} from "../src/TimeCurve.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {PrizeVault} from "../src/sinks/PrizeVault.sol";

contract DrillUSDM is ERC20 {
    constructor() ERC20("DrillUSDM", "DUSDM") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract DrillLT is ERC20 {
    constructor() ERC20("DrillLT", "DLT") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Minimal TimeCurve + deps for `anvil_same_block_drill.sh`. Prints addresses for `cast`.
contract AnvilSameBlockDrill is Script {
    uint256 internal constant ONE_DAY = 86_400;
    uint256 internal constant FOUR_DAYS = 4 * ONE_DAY;

    function run() external {
        uint256 deployerKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(deployerKey);
        vm.startBroadcast(deployerKey);

        DrillUSDM usdm = new DrillUSDM();
        DrillLT lt = new DrillLT();
        address s0 = address(0x100);
        address s1 = address(0x101);
        PrizeVault pv = new PrizeVault(deployer);
        address s3 = address(0x103);
        FeeRouter router = new FeeRouter(
            deployer,
            [s0, s1, address(pv), s3],
            [uint16(3000), uint16(2000), uint16(3500), uint16(1500)]
        );
        TimeCurve tc = new TimeCurve(
            IERC20(address(usdm)),
            IERC20(address(lt)),
            router,
            pv,
            address(0),
            1e18,
            0,
            10,
            120,
            ONE_DAY,
            FOUR_DAYS,
            1_000_000e18,
            3600,
            3600
        );
        pv.grantRole(pv.DISTRIBUTOR_ROLE(), address(tc));
        lt.mint(address(tc), 1_000_000e18);
        tc.startSale();

        vm.stopBroadcast();

        console2.log("DRILL_USDM", address(usdm));
        console2.log("DRILL_TC", address(tc));
        console2.log("DRILL_DEPLOYER", deployer);
    }
}
