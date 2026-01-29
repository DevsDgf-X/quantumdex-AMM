// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract TokenStreaming is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    struct Timeframe {
        uint256 startBlock;
        uint256 endBlock;
    }

    struct Stream {
        address sender;
        address recipient;
        address token;
        uint256 balance;         // Current balance deposited in the stream
        Timeframe timeframe;
        uint256 paymentPerBlock;
        uint256 withdrawnAmount; // Total amount already withdrawn
        uint256 settledAmount;   // Amount earned in previous configurations
        bool isActive;
    }

    uint256 private _streamIdCounter;
    mapping(uint256 => Stream) public streams;

    event StreamCreated(uint256 indexed streamId, address indexed sender, address indexed recipient, address token, uint256 amount);
    event StreamRefueled(uint256 indexed streamId, uint256 amount);
    event TokensWithdrawn(uint256 indexed streamId, address indexed recipient, uint256 amount);
    event StreamRefunded(uint256 indexed streamId, address indexed sender, uint256 amount);
    event StreamUpdated(uint256 indexed streamId, uint256 newPaymentPerBlock, uint256 newStartBlock, uint256 newEndBlock);

    error InvalidAddress();
    error InvalidAmount();
    error InvalidTimeframe();
    error StreamNotActive();
    error Unauthorized();
    error InsufficientBalance();
    error InvalidSignature();
    error StreamAlreadyEnded();

    constructor() {}

    function createStream(
        address recipient,
        address token,
        uint256 initialBalance,
        Timeframe memory timeframe,
        uint256 paymentPerBlock
    ) external payable nonReentrant returns (uint256) {
        if (recipient == address(0)) revert InvalidAddress();
        if (initialBalance == 0) revert InvalidAmount();
        if (timeframe.startBlock >= timeframe.endBlock) revert InvalidTimeframe();
        if (paymentPerBlock == 0) revert InvalidAmount();

        if (token == address(0)) {
            // Handle native ETH
            if (msg.value != initialBalance) revert InvalidAmount();
        } else {
            // Handle ERC20
            if (msg.value > 0) revert InvalidAmount(); // Should not send ETH with ERC20 call
            IERC20(token).safeTransferFrom(msg.sender, address(this), initialBalance);
        }

        _streamIdCounter++;
        uint256 streamId = _streamIdCounter;

        streams[streamId] = Stream({
            sender: msg.sender,
            recipient: recipient,
            token: token,
            balance: initialBalance,
            timeframe: timeframe,
            paymentPerBlock: paymentPerBlock,
            withdrawnAmount: 0,
            settledAmount: 0,
            isActive: true
        });

        emit StreamCreated(streamId, msg.sender, recipient, token, initialBalance);
        return streamId;
    }

    function refuel(uint256 streamId, uint256 amount) external payable nonReentrant {
        Stream storage stream = streams[streamId];
        if (!stream.isActive) revert StreamNotActive();
        if (msg.sender != stream.sender) revert Unauthorized();
        if (amount == 0) revert InvalidAmount();

        if (stream.token == address(0)) {
            // Handle native ETH
            if (msg.value != amount) revert InvalidAmount();
        } else {
            // Handle ERC20
            if (msg.value > 0) revert InvalidAmount();
            IERC20(stream.token).safeTransferFrom(msg.sender, address(this), amount);
        }
        
        stream.balance += amount;

        emit StreamRefueled(streamId, amount);
    }

    function withdraw(uint256 streamId) external nonReentrant {
        Stream storage stream = streams[streamId];
        if (!stream.isActive) revert StreamNotActive();
        if (msg.sender != stream.recipient) revert Unauthorized();

        uint256 withdrawable = _calculateWithdrawable(stream);
        if (withdrawable == 0) revert InsufficientBalance();

        stream.withdrawnAmount += withdrawable;
        stream.balance -= withdrawable;

        if (stream.token == address(0)) {
            // Handle native ETH
            (bool success, ) = stream.recipient.call{value: withdrawable}("");
            if (!success) revert InvalidAddress(); // Transfer failed
        } else {
            // Handle ERC20
            IERC20(stream.token).safeTransfer(stream.recipient, withdrawable);
        }

        emit TokensWithdrawn(streamId, stream.recipient, withdrawable);
    }

    function refund(uint256 streamId) external nonReentrant {
        Stream storage stream = streams[streamId];
        if (!stream.isActive) revert StreamNotActive();
        if (msg.sender != stream.sender) revert Unauthorized();

        if (block.number < stream.timeframe.endBlock) revert StreamNotActive();

        uint256 dueToRecipient = _calculateDue(stream);
        uint256 alreadyWithdrawn = stream.withdrawnAmount;
        
        uint256 totalNeeded = dueToRecipient > alreadyWithdrawn ? dueToRecipient - alreadyWithdrawn : 0;
        
        if (stream.balance > totalNeeded) {
            uint256 refundAmount = stream.balance - totalNeeded;
            stream.balance -= refundAmount;
            
            if (stream.token == address(0)) {
                // Handle native ETH
                (bool success, ) = stream.sender.call{value: refundAmount}("");
                if (!success) revert InvalidAddress();
            } else {
                // Handle ERC20
                IERC20(stream.token).safeTransfer(stream.sender, refundAmount);
            }
            emit StreamRefunded(streamId, stream.sender, refundAmount);
        }
    }

    function getStream(uint256 streamId) external view returns (Stream memory) {
        return streams[streamId];
    }

    function getWithdrawableBalance(uint256 streamId, address account) external view returns (uint256) {
        Stream memory stream = streams[streamId];
        if (account == stream.recipient) {
            return _calculateWithdrawable(stream);
        }
        return 0;
    }

    function _calculateDue(Stream memory stream) internal view returns (uint256) {
        uint256 currentPeriod = 0;
        // Only calculate current period if we have started
        if (block.number > stream.timeframe.startBlock) {
             uint256 end = block.number < stream.timeframe.endBlock ? block.number : stream.timeframe.endBlock;
             uint256 duration = end - stream.timeframe.startBlock;
             currentPeriod = duration * stream.paymentPerBlock;
        }
        return stream.settledAmount + currentPeriod;
    }

    function _calculateWithdrawable(Stream memory stream) internal view returns (uint256) {
        uint256 totalDue = _calculateDue(stream);
        if (totalDue <= stream.withdrawnAmount) return 0;
        uint256 pending = totalDue - stream.withdrawnAmount;
        
        return pending > stream.balance ? stream.balance : pending;
    }

    function hashStream(
        uint256 streamId,
        uint256 newPaymentPerBlock,
        Timeframe memory newTimeframe
    ) public view returns (bytes32) {
        return MessageHashUtils.toEthSignedMessageHash(
            keccak256(
                abi.encodePacked(
                    address(this),
                    streamId,
                    newPaymentPerBlock,
                    newTimeframe.startBlock,
                    newTimeframe.endBlock
                )
            )
        );
    }

    function updateStreamDetails(
        uint256 streamId,
        uint256 newPaymentPerBlock,
        Timeframe memory newTimeframe,
        bytes calldata signature
    ) external nonReentrant {
        Stream storage stream = streams[streamId];
        if (!stream.isActive) revert StreamNotActive();
        
        if (block.number >= stream.timeframe.endBlock) revert StreamAlreadyEnded();

        address signer;
        if (msg.sender == stream.sender) {
            signer = stream.recipient;
        } else if (msg.sender == stream.recipient) {
            signer = stream.sender;
        } else {
            revert Unauthorized();
        }

        bytes32 hash = hashStream(streamId, newPaymentPerBlock, newTimeframe);
        if (hash.recover(signature) != signer) revert InvalidSignature();

        // Checkpoint earnings
        uint256 dueNow = _calculateDue(stream);
        stream.settledAmount = dueNow;

        // Update params
        if (newTimeframe.startBlock < block.number) revert InvalidTimeframe();
        
        stream.timeframe = newTimeframe;
        stream.paymentPerBlock = newPaymentPerBlock;
        
        emit StreamUpdated(streamId, newPaymentPerBlock, newTimeframe.startBlock, newTimeframe.endBlock);
    }
}
