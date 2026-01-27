import { expect } from "chai";
import { ethers } from "hardhat";
import { TokenStreaming, MockToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("TokenStreaming", function () {
  let tokenStreaming: TokenStreaming;
  let mockToken: MockToken;
  let owner: SignerWithAddress;
  let sender: SignerWithAddress;
  let recipient: SignerWithAddress;
  let otherAccount: SignerWithAddress;

  const INITIAL_BALANCE = ethers.parseEther("1000");
  const PAYMENT_PER_BLOCK = ethers.parseEther("1");

  beforeEach(async function () {
    [owner, sender, recipient, otherAccount] = await ethers.getSigners();

    const MockTokenFactory = await ethers.getContractFactory("MockToken");
    mockToken = await MockTokenFactory.deploy("Mock Token", "MTK", 18);
    await mockToken.waitForDeployment();

    const TokenStreamingFactory = await ethers.getContractFactory("TokenStreaming");
    tokenStreaming = await TokenStreamingFactory.deploy();
    await tokenStreaming.waitForDeployment();

    // Setup sender with tokens
    await mockToken.mint(sender.address, INITIAL_BALANCE * 10n);
    await mockToken.connect(sender).approve(await tokenStreaming.getAddress(), INITIAL_BALANCE * 10n);
  });

  describe("Stream Creation", function () {
    it("Should create a stream successfully", async function () {
      const currentBlock = BigInt(await ethers.provider.getBlockNumber());
      const timeframe = {
        startBlock: currentBlock + 10n,
        endBlock: currentBlock + 110n,
      };

      await expect(tokenStreaming.connect(sender).createStream(
        recipient.address,
        await mockToken.getAddress(),
        INITIAL_BALANCE,
        timeframe,
        PAYMENT_PER_BLOCK
      )).to.emit(tokenStreaming, "StreamCreated")
        .withArgs(1, sender.address, recipient.address, await mockToken.getAddress(), INITIAL_BALANCE);

      const stream = await tokenStreaming.streams(1);
      expect(stream.sender).to.equal(sender.address);
      expect(stream.recipient).to.equal(recipient.address);
      expect(stream.balance).to.equal(INITIAL_BALANCE);
      expect(stream.isActive).to.be.true;
    });

    it("Should fail if recipient is zero address", async function () {
      const timeframe = { startBlock: 10n, endBlock: 100n };
      await expect(tokenStreaming.connect(sender).createStream(
        ethers.ZeroAddress,
        await mockToken.getAddress(),
        INITIAL_BALANCE,
        timeframe,
        PAYMENT_PER_BLOCK
      )).to.be.revertedWithCustomError(tokenStreaming, "InvalidAddress");
    });
  });

  describe("Refuel", function () {
    let streamId: bigint;

    beforeEach(async function () {
      const currentBlock = BigInt(await ethers.provider.getBlockNumber());
      const timeframe = {
        startBlock: currentBlock + 10n,
        endBlock: currentBlock + 110n,
      };
      await tokenStreaming.connect(sender).createStream(
        recipient.address,
        await mockToken.getAddress(),
        INITIAL_BALANCE,
        timeframe,
        PAYMENT_PER_BLOCK
      );
      streamId = 1n;
    });

    it("Should refuel an existing stream", async function () {
      const refuelAmount = ethers.parseEther("500");
      await expect(tokenStreaming.connect(sender).refuel(streamId, refuelAmount))
        .to.emit(tokenStreaming, "StreamRefueled")
        .withArgs(streamId, refuelAmount);

      const stream = await tokenStreaming.streams(streamId);
      expect(stream.balance).to.equal(INITIAL_BALANCE + refuelAmount);
    });

    it("Should fail if refueled by non-sender", async function () {
      await expect(tokenStreaming.connect(otherAccount).refuel(streamId, 100))
        .to.be.revertedWithCustomError(tokenStreaming, "Unauthorized");
    });
  });

  describe("Withdrawal", function () {
    let streamId: bigint;
    let startBlock: bigint;

    beforeEach(async function () {
      const currentBlock = BigInt(await ethers.provider.getBlockNumber());
      startBlock = currentBlock + 5n;
      const timeframe = {
        startBlock: startBlock,
        endBlock: startBlock + 100n,
      };
      await tokenStreaming.connect(sender).createStream(
        recipient.address,
        await mockToken.getAddress(),
        INITIAL_BALANCE,
        timeframe,
        PAYMENT_PER_BLOCK
      );
      streamId = 1n;
    });

    it("Should allow recipient to withdraw accrued tokens", async function () {
      // Mine blocks to accrue tokens
      await time.advanceBlockTo(startBlock + 10n);
      
      const currentBlock = BigInt(await ethers.provider.getBlockNumber());
      // withdrawal transaction will mine another block
      const expectedWithdrawable = (currentBlock + 1n - startBlock) * PAYMENT_PER_BLOCK;
      const initialRecipientBalance = await mockToken.balanceOf(recipient.address);

      await expect(tokenStreaming.connect(recipient).withdraw(streamId))
        .to.emit(tokenStreaming, "TokensWithdrawn")
        .withArgs(streamId, recipient.address, expectedWithdrawable);

      expect(await mockToken.balanceOf(recipient.address)).to.equal(initialRecipientBalance + expectedWithdrawable);
    });
  });

  describe("Refund", function () {
    let streamId: bigint;
    let startBlock: bigint;
    let endBlock: bigint;

    beforeEach(async function () {
      const currentBlock = BigInt(await ethers.provider.getBlockNumber());
      startBlock = currentBlock + 5n;
      endBlock = startBlock + 10n;
      const timeframe = {
        startBlock: startBlock,
        endBlock: endBlock,
      };
      await tokenStreaming.connect(sender).createStream(
        recipient.address,
        await mockToken.getAddress(),
        INITIAL_BALANCE,
        timeframe,
        PAYMENT_PER_BLOCK
      );
      streamId = 1n;
    });

    it("Should allow sender to refund excess tokens after end", async function () {
      await time.advanceBlockTo(endBlock + 1n);
      
      const totalDue = (endBlock - startBlock) * PAYMENT_PER_BLOCK;
      const expectedRefund = INITIAL_BALANCE - totalDue;

      await expect(tokenStreaming.connect(sender).refund(streamId))
        .to.emit(tokenStreaming, "StreamRefunded")
        .withArgs(streamId, sender.address, expectedRefund);
    });

    it("Should fail if refund before end", async function () {
      await expect(tokenStreaming.connect(sender).refund(streamId))
        .to.be.revertedWithCustomError(tokenStreaming, "StreamNotActive");
    });
  });

  describe("Update Stream Details", function () {
    let streamId: bigint;

    beforeEach(async function () {
      const currentBlock = BigInt(await ethers.provider.getBlockNumber());
      const timeframe = {
        startBlock: currentBlock + 10n,
        endBlock: currentBlock + 110n,
      };
      await tokenStreaming.connect(sender).createStream(
        recipient.address,
        await mockToken.getAddress(),
        INITIAL_BALANCE,
        timeframe,
        PAYMENT_PER_BLOCK
      );
      streamId = 1n;
    });

    it("Should update stream details with dual-party consent (signature)", async function () {
      const newPaymentPerBlock = ethers.parseEther("2");
      const currentBlock = BigInt(await ethers.provider.getBlockNumber());
      const newTimeframe = {
        startBlock: currentBlock + 20n,
        endBlock: currentBlock + 120n,
      };

      const hash = ethers.keccak256(
        ethers.solidityPacked(
          ["address", "uint256", "uint256", "uint256", "uint256"],
          [await tokenStreaming.getAddress(), streamId, newPaymentPerBlock, newTimeframe.startBlock, newTimeframe.endBlock]
        )
      );
      const signature = await recipient.signMessage(ethers.toBeArray(hash));

      await expect(tokenStreaming.connect(sender).updateStreamDetails(
        streamId,
        newPaymentPerBlock,
        newTimeframe,
        signature
      )).to.emit(tokenStreaming, "StreamUpdated")
        .withArgs(streamId, newPaymentPerBlock, newTimeframe.startBlock, newTimeframe.endBlock);
      
      const stream = await tokenStreaming.streams(streamId);
      expect(stream.paymentPerBlock).to.equal(newPaymentPerBlock);
      expect(stream.timeframe.startBlock).to.equal(newTimeframe.startBlock);
    });
  });
});
