// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title QuantumDEX Governance Token
/// @notice ERC20 token with voting capabilities for protocol governance
/// @dev Extends ERC20Votes to enable on-chain governance via OpenZeppelin Governor
contract GovernanceToken is ERC20, ERC20Permit, ERC20Votes, Ownable {
    /// @notice Maximum supply of governance tokens
    uint256 public constant MAX_SUPPLY = 10_000_000 * 10**18; // 10 million tokens

    /// @notice Emitted when tokens are minted
    event TokensMinted(address indexed to, uint256 amount);

    /// @notice Emitted when tokens are burned
    event TokensBurned(address indexed from, uint256 amount);

    constructor(
        address initialOwner
    ) ERC20("QuantumDEX Governance", "QDEX") ERC20Permit("QuantumDEX Governance") Ownable(initialOwner) {
        // Initial supply can be minted by owner for distribution
    }

    /// @notice Mint new tokens (only owner)
    /// @dev Can only mint if total supply doesn't exceed MAX_SUPPLY
    /// @param to Address to mint tokens to
    /// @param amount Amount of tokens to mint
    function mint(address to, uint256 amount) external onlyOwner {
        if (totalSupply() + amount > MAX_SUPPLY) {
            revert("Exceeds max supply");
        }
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /// @notice Batch mint tokens to multiple addresses (only owner)
    /// @param recipients Array of recipient addresses
    /// @param amounts Array of token amounts (must match recipients length)
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        if (recipients.length != amounts.length) {
            revert("Arrays length mismatch");
        }

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }

        if (totalSupply() + totalAmount > MAX_SUPPLY) {
            revert("Exceeds max supply");
        }

        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amounts[i]);
            emit TokensMinted(recipients[i], amounts[i]);
        }
    }

    /// @notice Burn tokens from caller's balance
    /// @param amount Amount of tokens to burn
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount);
    }

    // The following functions are overrides required by Solidity.
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }

    function nonces(address owner) public view virtual override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}

