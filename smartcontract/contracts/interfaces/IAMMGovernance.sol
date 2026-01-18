// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

/// @title AMM Governance Interface
/// @notice Defines governance-controlled functions for AMM protocol
/// @dev This interface allows the Governor to propose and execute parameter changes
interface IAMMGovernance {
    /// @notice Emitted when a governance parameter is updated
    event ParameterUpdated(string parameter, uint256 oldValue, uint256 newValue);

    /// @notice Update protocol-wide fee (if supported by implementation)
    /// @dev This would require an upgradeable AMM contract
    /// @param newFeeBps New fee in basis points
    function updateDefaultFee(uint16 newFeeBps) external;

    /// @notice Update minimum liquidity lock amount
    /// @dev Only callable by governance (timelock)
    /// @param newMinimumLiquidity New minimum liquidity value
    function updateMinimumLiquidity(uint256 newMinimumLiquidity) external;

    /// @notice Update flash loan fee
    /// @dev Only callable by governance (timelock)
    /// @param newFlashLoanFeeBps New flash loan fee in basis points
    function updateFlashLoanFee(uint16 newFlashLoanFeeBps) external;

    /// @notice Pause the AMM contract (emergency only)
    /// @dev Only callable by governance (timelock)
    function pause() external;

    /// @notice Unpause the AMM contract
    /// @dev Only callable by governance (timelock)
    function unpause() external;
}

