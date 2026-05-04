// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LeprechaunNFT} from "../src/LeprechaunNFT.sol";

contract LeprechaunNFTTest is Test {
    LeprechaunNFT nft;
    address alice = makeAddr("alice");

    function setUp() public {
        nft = new LeprechaunNFT("Leprechaun", "LEPR", "https://meta.example.com/", address(this));
        nft.createSeries(100); // series 0
    }

    function _defaultTraits(uint256 seriesId) internal pure returns (LeprechaunNFT.Traits memory) {
        return LeprechaunNFT.Traits({
            seriesId: seriesId,
            rarityTier: 0,
            role: 1,
            passiveEffectType: 0,
            setId: 0,
            setPosition: 0,
            bonusCategory: 0,
            bonusValue: 100,
            synergyTag: 0,
            agentTradable: true,
            agentLendable: false,
            factionLocked: false
        });
    }

    function test_mint_basic() public {
        uint256 id = nft.mint(alice, _defaultTraits(0));
        assertEq(nft.ownerOf(id), alice);
        assertEq(nft.totalSupply(), 1);
    }

    function test_traits_stored_onchain() public {
        LeprechaunNFT.Traits memory t = _defaultTraits(0);
        t.rarityTier = 3;
        t.bonusValue = 42;
        uint256 id = nft.mint(alice, t);

        (uint256 seriesId, uint8 rarity,,,,,, uint256 bonusValue,,,,) = nft.tokenTraits(id);
        assertEq(seriesId, 0);
        assertEq(rarity, 3);
        assertEq(bonusValue, 42);
    }

    function test_series_max_supply_enforced() public {
        nft.createSeries(2); // series 1, max 2
        LeprechaunNFT.Traits memory t = _defaultTraits(1);
        nft.mint(alice, t);
        nft.mint(alice, t);
        vm.expectRevert("NFT: series full");
        nft.mint(alice, t);
    }

    function test_inactive_series_reverts() public {
        LeprechaunNFT.Traits memory t = _defaultTraits(99);
        vm.expectRevert("NFT: series inactive");
        nft.mint(alice, t);
    }

    function test_mint_unauthorized_reverts() public {
        vm.prank(alice);
        vm.expectRevert();
        nft.mint(alice, _defaultTraits(0));
    }

    function test_createSeries_zero_supply_reverts() public {
        vm.expectRevert("NFT: zero supply");
        nft.createSeries(0);
    }

    function test_setBaseURI() public {
        nft.setBaseURI("https://new.example.com/");
        assertEq(nft.tokenURI(nft.mint(alice, _defaultTraits(0))), "https://new.example.com/0");
    }

    /// @dev INV-LEP-125: `tokenURI` for an already-minted token follows the updated prefix (audit I-02 disclosure).
    function test_setBaseURI_updates_existing_tokenURI() public {
        uint256 id = nft.mint(alice, _defaultTraits(0));
        assertEq(nft.tokenURI(id), "https://meta.example.com/0");
        nft.setBaseURI("https://moved.cdn.example/");
        assertEq(nft.tokenURI(id), "https://moved.cdn.example/0");
    }

    function test_setBaseURI_non_admin_reverts() public {
        vm.prank(alice);
        vm.expectRevert();
        nft.setBaseURI("https://evil.example/");
    }

    /// @dev Invariant: series minted count never exceeds max.
    function test_series_mint_count_fuzz(uint8 count) public {
        uint256 cap = uint256(count) % 50 + 1;
        uint256 sid = nft.createSeries(cap);
        LeprechaunNFT.Traits memory t = _defaultTraits(sid);
        for (uint256 i; i < cap; ++i) {
            nft.mint(alice, t);
        }
        (, uint256 minted,) = nft.series(sid);
        assertEq(minted, cap);
    }
}
