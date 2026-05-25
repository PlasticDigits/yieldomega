// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DoubAirdrop} from "../src/DoubAirdrop.sol";

/// @dev Gas probe on a MegaETH mainnet fork (standard EVM; not MegaEVM state-growth metering).
///      Run from `contracts/`: forge test --match-contract DoubAirdropMegaethFork --fork-url megaeth -vv --ffi
contract DoubAirdropMegaethForkTest is Test {
    address internal constant DOUB = 0xc3654B4f879937B767aFBB64B7C230FF436d2342;
    address internal constant AIRDROP = 0x3CAf127624d8b81F4aa00aD1cCBbc9242B502e5d;

    function _loadBatch(uint256 n) internal returns (address[] memory recipients, uint256[] memory values) {
        string[] memory inputs = new string[](4);
        inputs[0] = "python3";
        inputs[1] = "../airdrop/export_batch.py";
        inputs[2] = "../airdrop/doub.csv";
        inputs[3] = vm.toString(n);
        string memory json = string(vm.ffi(inputs));
        recipients = vm.parseJsonAddressArray(json, ".recipients");
        values = vm.parseJsonUintArray(json, ".amountsWei");
    }

    function _probe(uint256 n) internal {
        (address[] memory recipients, uint256[] memory values) = _loadBatch(n);
        uint256 total;
        for (uint256 i; i < values.length; ++i) {
            total += values[i];
        }
        deal(DOUB, address(this), total);
        IERC20(DOUB).approve(AIRDROP, total);
        uint256 g0 = gasleft();
        DoubAirdrop(AIRDROP).disperseToken(IERC20(DOUB), recipients, values);
        console2.log("fork disperse n", n);
        console2.log("gas used", g0 - gasleft());
    }

    function test_fork_500() public {
        vm.createSelectFork("megaeth");
        _probe(500);
    }

    function test_fork_1000() public {
        vm.createSelectFork("megaeth");
        _probe(1000);
    }

    function test_fork_1500() public {
        vm.createSelectFork("megaeth");
        _probe(1500);
    }

    function test_fork_2000() public {
        vm.createSelectFork("megaeth");
        _probe(2000);
    }
}
