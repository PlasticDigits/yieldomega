// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {PlayCred} from "../src/PlayCred.sol";
import {TimeArena} from "../src/arena/TimeArena.sol";
import {PodiumVaults} from "../src/arena/PodiumVaults.sol";
import {ArenaPodiumTimerConfig} from "../src/arena/libraries/ArenaPodiumTimerConfig.sol";

/// @dev GitLab #312 — Anvil gas benchmark for incremental WarBow top-3 ranking at scale.
contract TimeArenaWarbowBenchmarkTest is Test {
    uint256 internal constant PLAYER_COUNT = 10_000;
    uint256 internal constant SLOT_BATTLE_POINTS = 57;
    uint256 internal constant SLOT_BP_GENERATION = 59;
    uint256 internal constant SLOT_CACHED_LEVEL = 103;
    uint256 internal constant WAD = 1e18;
    uint256 internal constant CHARM_MIN = 99e16;

    Doubloon doub;
    TimeArena arena;
    PodiumVaults vaults;

    function setUp() public {
        (uint256[4] memory ext, uint256[4] memory init, uint256[4] memory cap, uint256[4] memory below, uint256[4] memory to) =
            ArenaPodiumTimerConfig.getProductionDefaults();

        doub = new Doubloon(address(this));
        PlayCred cred = new PlayCred(address(this));
        vaults = new PodiumVaults(doub, address(this));

        TimeArena impl = new TimeArena();
        bytes memory data = abi.encodeCall(
            TimeArena.initialize,
            (doub, vaults, address(0), address(cred), 1000e18, ext, init, cap, below, to, 300, address(this))
        );
        arena = TimeArena(payable(address(new ERC1967Proxy(address(impl), data))));
        vaults.setArena(address(arena));
        cred.grantRole(cred.MINTER_ROLE(), address(arena));
        arena.startArena();
        doub.grantRole(doub.MINTER_ROLE(), address(this));
    }

    function _writeMapping(uint256 baseSlot, address key, uint256 value) internal {
        vm.store(address(arena), keccak256(abi.encode(key, baseSlot)), bytes32(value));
    }

    function _fundPlayer(address player) internal {
        doub.mint(player, 50_000e18);
        vm.prank(player);
        doub.approve(address(arena), type(uint256).max);
        _writeMapping(SLOT_CACHED_LEVEL, player, 4);
    }

    function test_benchmark_warbow_10k_player_ranking() public {
        uint256 gen = arena.warbowBpGeneration();

        vm.pauseGasMetering();
        for (uint256 i; i < PLAYER_COUNT; ++i) {
            address player = address(uint160(0x10000 + i));
            _writeMapping(SLOT_BATTLE_POINTS, player, PLAYER_COUNT - i);
            _writeMapping(SLOT_BP_GENERATION, player, gen);
        }
        address[3] memory top = [
            address(uint160(0x10000)),
            address(uint160(0x10001)),
            address(uint160(0x10002))
        ];
        for (uint256 i; i < 3; ++i) {
            _fundPlayer(top[i]);
            if (i > 0) vm.warp(block.timestamp + 1);
            vm.prank(top[i]);
            arena.buy(CHARM_MIN);
        }
        address mid = address(uint160(0x10000 + 5000));
        _fundPlayer(mid);
        vm.resumeGasMetering();

        uint256 updateGas;
        vm.startSnapshotGas("warbow_update_mid_rank");
        vm.prank(mid);
        arena.buy(CHARM_MIN);
        updateGas = vm.stopSnapshotGas();

        vm.startSnapshotGas("warbow_roll_10k");
        vm.warp(arena.podiumDeadline(arena.CAT_WARBOW()) + 1);
        arena.rollPodiumEpoch(arena.CAT_WARBOW());
        uint256 rollGas = vm.stopSnapshotGas();

        emit log_named_uint("warbow_top3_update_gas_10k_state", updateGas);
        emit log_named_uint("warbow_roll_gas_10k_players", rollGas);
        assertLt(updateGas, 500_000, "incremental top-3 update should stay cheap");
        assertLt(rollGas, 2_000_000, "WarBow roll gas should stay under 2M on Anvil");
    }
}
