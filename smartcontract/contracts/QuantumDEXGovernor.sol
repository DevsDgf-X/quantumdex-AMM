// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import "./GovernanceToken.sol";

/// @title QuantumDEX Governor
/// @notice Governance contract for QuantumDEX protocol parameter management
/// @dev Uses OpenZeppelin Governor with timelock and quorum requirements
contract QuantumDEXGovernor is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    /// @notice Minimum voting delay in blocks (1 day ~= 7200 blocks on Base)
    uint256 public constant MIN_VOTING_DELAY = 1;

    /// @notice Minimum voting period in blocks (3 days ~= 21600 blocks on Base)
    uint256 public constant MIN_VOTING_PERIOD = 7200;

    /// @notice Minimum proposal threshold
    uint256 public constant MIN_PROPOSAL_THRESHOLD = 1000 * 10**18; // 1000 tokens

    /// @notice Minimum quorum percentage (4%)
    uint256 public constant MIN_QUORUM_PERCENTAGE = 4;

    constructor(
        GovernanceToken _token,
        TimelockController _timelock,
        uint256 _votingDelay,
        uint256 _votingPeriod,
        uint256 _proposalThreshold,
        uint256 _quorumPercentage
    )
        Governor("QuantumDEX Governor")
        GovernorSettings(_votingDelay, _votingPeriod, _proposalThreshold)
        GovernorVotes(IVotes(address(_token)))
        GovernorVotesQuorumFraction(_quorumPercentage)
        GovernorTimelockControl(_timelock)
    {
        // Validate constructor parameters
        if (_votingDelay < MIN_VOTING_DELAY) {
            revert("Voting delay too low");
        }
        if (_votingPeriod < MIN_VOTING_PERIOD) {
            revert("Voting period too low");
        }
        if (_proposalThreshold < MIN_PROPOSAL_THRESHOLD) {
            revert("Proposal threshold too low");
        }
        if (_quorumPercentage < MIN_QUORUM_PERCENTAGE) {
            revert("Quorum percentage too low");
        }
        if (_quorumPercentage > 100) {
            revert("Quorum percentage too high");
        }
    }

    /// @notice Get the voting delay (blocks before voting starts)
    function votingDelay() public view override(IGovernor, GovernorSettings) returns (uint256) {
        return super.votingDelay();
    }

    /// @notice Get the voting period (blocks voting is open)
    function votingPeriod() public view override(IGovernor, GovernorSettings) returns (uint256) {
        return super.votingPeriod();
    }

    /// @notice Get the proposal threshold (minimum tokens needed to propose)
    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.proposalThreshold();
    }

    /// @notice Get the quorum required for proposal to pass
    function quorum(
        uint256 blockNumber
    ) public view override(IGovernor, GovernorVotesQuorumFraction) returns (uint256) {
        return super.quorum(blockNumber);
    }

    /// @notice Check if a proposal state is valid
    function state(
        uint256 proposalId
    ) public view override(Governor, GovernorTimelockControl) returns (ProposalState) {
        return super.state(proposalId);
    }

    /// @notice Execute a proposal after timelock
    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
    }

    /// @notice Cancel a proposal
    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    /// @notice Get the executor address (timelock)
    function _executor() internal view override(Governor, GovernorTimelockControl) returns (address) {
        return super._executor();
    }

    /// @notice Returns whether the interface is supported
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(Governor, GovernorTimelockControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}

