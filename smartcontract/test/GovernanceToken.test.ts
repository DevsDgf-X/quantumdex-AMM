import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import type { GovernanceToken } from "../typechain-types";

describe("GovernanceToken Tests", function () {
  const MAX_SUPPLY = ethers.parseEther("10000000"); // 10 million tokens
  const INITIAL_MINT = ethers.parseEther("1000");

  async function deployGovernanceTokenFixture() {
    const signers = await ethers.getSigners();
    const [deployer, alice, bob] = signers;

    const GovernanceTokenFactory = await ethers.getContractFactory("GovernanceToken", deployer);
    const token = await GovernanceTokenFactory.deploy(deployer.address) as any;
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();

    return {
      token,
      deployer,
      alice,
      bob,
      tokenAddress,
    };
  }

  describe("Deployment", function () {
    it("Should deploy with correct name and symbol", async function () {
      const { token } = await loadFixture(deployGovernanceTokenFixture);

      expect(await token.name()).to.equal("QuantumDEX Governance");
      expect(await token.symbol()).to.equal("QDEX");
    });

    it("Should set deployer as owner", async function () {
      const { token, deployer } = await loadFixture(deployGovernanceTokenFixture);

      expect(await token.owner()).to.equal(deployer.address);
    });

    it("Should have zero initial supply", async function () {
      const { token } = await loadFixture(deployGovernanceTokenFixture);

      expect(await token.totalSupply()).to.equal(0);
    });

    it("Should have correct max supply", async function () {
      const { token } = await loadFixture(deployGovernanceTokenFixture);

      expect(await token.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint tokens", async function () {
      const { token, deployer, alice } = await loadFixture(deployGovernanceTokenFixture);

      await token.mint(alice.address, INITIAL_MINT);

      expect(await token.balanceOf(alice.address)).to.equal(INITIAL_MINT);
      expect(await token.totalSupply()).to.equal(INITIAL_MINT);
    });

    it("Should emit TokensMinted event on mint", async function () {
      const { token, deployer, alice } = await loadFixture(deployGovernanceTokenFixture);

      await expect(token.mint(alice.address, INITIAL_MINT))
        .to.emit(token, "TokensMinted")
        .withArgs(alice.address, INITIAL_MINT);
    });

    it("Should revert if non-owner tries to mint", async function () {
      const { token, alice, bob } = await loadFixture(deployGovernanceTokenFixture);

      await expect(
        token.connect(alice).mint(bob.address, INITIAL_MINT)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("Should revert if minting would exceed max supply", async function () {
      const { token, deployer, alice } = await loadFixture(deployGovernanceTokenFixture);

      // Mint up to max supply
      await token.mint(alice.address, MAX_SUPPLY);

      // Try to mint one more token
      await expect(
        token.mint(alice.address, 1)
      ).to.be.revertedWith("Exceeds max supply");
    });

    it("Should allow minting up to max supply", async function () {
      const { token, deployer, alice } = await loadFixture(deployGovernanceTokenFixture);

      await token.mint(alice.address, MAX_SUPPLY);

      expect(await token.totalSupply()).to.equal(MAX_SUPPLY);
      expect(await token.balanceOf(alice.address)).to.equal(MAX_SUPPLY);
    });
  });

  describe("Batch Minting", function () {
    it("Should allow owner to batch mint tokens", async function () {
      const { token, deployer, alice, bob } = await loadFixture(deployGovernanceTokenFixture);

      const recipients = [alice.address, bob.address];
      const amounts = [INITIAL_MINT, INITIAL_MINT];

      await token.batchMint(recipients, amounts);

      expect(await token.balanceOf(alice.address)).to.equal(INITIAL_MINT);
      expect(await token.balanceOf(bob.address)).to.equal(INITIAL_MINT);
      expect(await token.totalSupply()).to.equal(INITIAL_MINT * 2n);
    });

    it("Should revert if arrays length mismatch", async function () {
      const { token, deployer, alice, bob } = await loadFixture(deployGovernanceTokenFixture);

      const recipients = [alice.address, bob.address];
      const amounts = [INITIAL_MINT]; // Mismatched length

      await expect(
        token.batchMint(recipients, amounts)
      ).to.be.revertedWith("Arrays length mismatch");
    });

    it("Should revert if batch mint would exceed max supply", async function () {
      const { token, deployer, alice } = await loadFixture(deployGovernanceTokenFixture);

      // Mint close to max supply
      const nearMax = MAX_SUPPLY - ethers.parseEther("100");
      await token.mint(alice.address, nearMax);

      // Try to batch mint more than remaining
      const recipients = [alice.address];
      const amounts = [ethers.parseEther("200")]; // Exceeds remaining

      await expect(
        token.batchMint(recipients, amounts)
      ).to.be.revertedWith("Exceeds max supply");
    });
  });

  describe("Burning", function () {
    it("Should allow token holder to burn their tokens", async function () {
      const { token, deployer, alice } = await loadFixture(deployGovernanceTokenFixture);

      await token.mint(alice.address, INITIAL_MINT);
      const burnAmount = ethers.parseEther("100");

      await token.connect(alice).burn(burnAmount);

      expect(await token.balanceOf(alice.address)).to.equal(INITIAL_MINT - burnAmount);
      expect(await token.totalSupply()).to.equal(INITIAL_MINT - burnAmount);
    });

    it("Should emit TokensBurned event on burn", async function () {
      const { token, deployer, alice } = await loadFixture(deployGovernanceTokenFixture);

      await token.mint(alice.address, INITIAL_MINT);
      const burnAmount = ethers.parseEther("100");

      await expect(token.connect(alice).burn(burnAmount))
        .to.emit(token, "TokensBurned")
        .withArgs(alice.address, burnAmount);
    });

    it("Should revert if trying to burn more than balance", async function () {
      const { token, deployer, alice } = await loadFixture(deployGovernanceTokenFixture);

      await token.mint(alice.address, INITIAL_MINT);

      await expect(
        token.connect(alice).burn(INITIAL_MINT + 1n)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });
  });

  describe("ERC20Votes Functionality", function () {
    it("Should track votes after token transfer", async function () {
      const { token, deployer, alice, bob } = await loadFixture(deployGovernanceTokenFixture);

      await token.mint(alice.address, INITIAL_MINT);
      
      // Get current block number for voting
      const blockNumber = await ethers.provider.getBlockNumber();
      
      // Transfer tokens (should update vote balance)
      await token.connect(alice).transfer(bob.address, ethers.parseEther("100"));

      // Check vote balances (may require delegation first)
      // ERC20Votes requires delegation for voting power
      await token.connect(alice).delegate(alice.address);
      await token.connect(bob).delegate(bob.address);

      // Move to next block for vote snapshot
      await ethers.provider.send("evm_mine", []);
      const nextBlock = await ethers.provider.getBlockNumber();

      const aliceVotes = await token.getPastVotes(alice.address, blockNumber);
      const bobVotes = await token.getPastVotes(bob.address, blockNumber);

      // Votes should reflect token balance at that block
      expect(aliceVotes).to.be.gt(0);
    });

    it("Should allow delegation of voting power", async function () {
      const { token, deployer, alice, bob } = await loadFixture(deployGovernanceTokenFixture);

      await token.mint(alice.address, INITIAL_MINT);

      await token.connect(alice).delegate(bob.address);

      // Move to next block
      await ethers.provider.send("evm_mine", []);
      const blockNumber = await ethers.provider.getBlockNumber();

      const bobVotes = await token.getPastVotes(bob.address, blockNumber);
      expect(bobVotes).to.equal(INITIAL_MINT);
    });
  });
});

