// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

// Imports audited OpenZeppelin contracts.
// ERC20: standard fungible token
// ERC20Burnable: holders can destroy their tokens (reduces total supply)
// ERC20Permit: EIP-2612 "permit()" enables gasless approvals via signatures
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title TENDER (TNDR) — fixed-supply ERC-20 on Base
/// @notice 50,000,000 TNDR minted at deployment; no further minting.
contract TENDER is ERC20, ERC20Burnable, ERC20Permit {
    // The constructor runs exactly once when the contract is deployed.
    // We mint the full supply to the deployer (you), then scripts can move
    // tokens to vesting and liquidity wallets.
    constructor(address initialRecipient)
        ERC20("TENDER", "TENDER")
        ERC20Permit("TENDER")
    {
        // 50,000,000 * 10^18 because ERC20 uses 18 decimals by default
        uint256 TOTAL_SUPPLY = 50_000_000 * (10 ** decimals());
        _mint(initialRecipient, TOTAL_SUPPLY);
    }
}