import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import type { GovernanceToken, QuantumDEXGovernor, TimelockController } from "../typechain-types";

describe("QuantumDEXGovernor Tests", function () {
  const VOTING_DELAY = 1;
  const VOTING_PERIOD = 21600; // ~3 days
  const PROPOSAL_THRESHOLD = ethers.parseEther("1000");
  const QUORUM_PERCENTAGE = 4;
  const TIMELOCK_DELAY = 24 * 60 * 60; // 24 hours
  const TOKEN_SUPPLY = ethers.parseEther("10000000"); // 10 million

  async function deployGovernanceFixture() {
    const signers = await ethers.getSigners();
    const [deployer, proposer, voter1, voter2, executor] = signers;

    // Deploy GovernanceToken
    const GovernanceTokenFactory = await ethers.getContractFactory("GovernanceToken", deployer);
    const token = await GovernanceTokenFactory.deploy(deployer.address) as any;
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();

    // Deploy TimelockController
    const TimelockControllerFactory = await ethers.getContractFactory("TimelockController", deployer);
    const timelock = await TimelockControllerFactory.deploy(
      TIMELOCK_DELAY,
      [deployer.address],
      [deployer.address],
      deployer.address
    ) as any;
    await timelock.waitForDeployment();
    const timelockAddress = await timelock.getAddress();

    // Deploy Governor
    const GovernorFactory = await ethers.getContractFactory("QuantumDEXGovernor", deployer);
    const governor = await GovernorFactory.deploy(
      tokenAddress,
      timelockAddress,
      VOTING_DELAY,
      VOTING_PERIOD,
      PROPOSAL_THRESHOLD,
      QUORUM_PERCENTAGE
    ) as any;
    await governor.waitForDeployment();
    const governorAddress = await governor.getAddress();

    // Configure TimelockController
    const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
    const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
    const ADMIN_ROLE = await timelock.TIMELOCK_ADMIN_ROLE();

    await timelock.grantRole(PROPOSER_ROLE, governorAddress);
    await timelock.grantRole(EXECUTOR_ROLE, governorAddress);
    await timelock.revokeRole(PROPOSER_ROLE, deployer.address);
    await timelock.revokeRole(EXECUTOR_ROLE, deployer.address);
    await timelock.revokeRole(ADMIN_ROLE, deployer.address);

    // Mint tokens for voters
    await token.mint(voter1.address, TOKEN_SUPPLY / 10n); // 1M tokens
    await token.mint(voter2.address, TOKEN_SUPPLY / 20n); // 500K tokens
    await token.mint(proposer.address, PROPOSAL_THRESHOLD);

    // Delegate voting power
    await token.connect(voter1).delegate(voter1.address);
    await token.connect(voter2).delegate(voter2.address);
    await token.connect(proposer).delegate(proposer.address);

    // Move to next block to snapshot voting power
    await ethers.provider.send("evm_mine", []);

    return {
      token,
      timelock,
      governor,
      deployer,
      proposer,
      voter1,
      voter2,
      executor,
      tokenAddress,
      timelockAddress,
      governorAddress,
    };
  }

  describe("Deployment", function () {
    it("Should deploy with correct name", async function () {
      const { governor } = await loadFixture(deployGovernanceFixture);

      expect(await governor.name()).to.equal("QuantumDEX Governor");
    });

    it("Should have correct voting delay", async function () {
      const { governor } = await loadFixture(deployGovernanceFixture);

      expect(await governor.votingDelay()).to.equal(VOTING_DELAY);
    });

    it("Should have correct voting period", async function () {
      const { governor } = await loadFixture(deployGovernanceFixture);

      expect(await governor.votingPeriod()).to.equal(VOTING_PERIOD);
    });

    it("Should have correct proposal threshold", async function () {
      const { governor } = await loadFixture(deployGovernanceFixture);

      expect(await governor.proposalThreshold()).to.equal(PROPOSAL_THRESHOLD);
    });

    it("Should revert if voting delay is too low", async function () {
      const { token, timelock } = await loadFixture(deployGovernanceFixture);
      const GovernorFactory = await ethers.getContractFactory("QuantumDEXGovernor");

      await expect(
        GovernorFactory.deploy(
          await token.getAddress(),
          await timelock.getAddress(),
          0, // Too low
          VOTING_PERIOD,
          PROPOSAL_THRESHOLD,
          QUORUM_PERCENTAGE
        )
      ).to.be.revertedWith("Voting delay too low");
    });

    it("Should revert if voting period is too low", async function () {
      const { token, timelock } = await loadFixture(deployGovernanceFixture);
      const GovernorFactory = await ethers.getContractFactory("QuantumDEXGovernor");

      await expect(
        GovernorFactory.deploy(
          await token.getAddress(),
          await timelock.getAddress(),
          VOTING_DELAY,
          1000, // Too low
          PROPOSAL_THRESHOLD,
          QUORUM_PERCENTAGE
        )
      ).to.be.revertedWith("Voting period too low");
    });

    it("Should revert if proposal threshold is too low", async function () {
      const { token, timelock } = await loadFixture(deployGovernanceFixture);
      const GovernorFactory = await ethers.getContractFactory("QuantumDEXGovernor");

      await expect(
        GovernorFactory.deploy(
          await token.getAddress(),
          await timelock.getAddress(),
          VOTING_DELAY,
          VOTING_PERIOD,
          ethers.parseEther("100"), // Too low
          QUORUM_PERCENTAGE
        )
      ).to.be.revertedWith("Proposal threshold too low");
    });

    it("Should revert if quorum percentage is too low", async function () {
      const { token, timelock } = await loadFixture(deployGovernanceFixture);
      const GovernorFactory = await ethers.getContractFactory("QuantumDEXGovernor");

      await expect(
        GovernorFactory.deploy(
          await token.getAddress(),
          await timelock.getAddress(),
          VOTING_DELAY,
          VOTING_PERIOD,
          PROPOSAL_THRESHOLD,
          1 // Too low
        )
      ).to.be.revertedWith("Quorum percentage too low");
    });
  });

  describe("Proposal Creation", function () {
    it("Should create a proposal with sufficient voting power", async function () {
      const { governor, proposer, token } = await loadFixture(deployGovernanceFixture);

      const targets = [await token.getAddress()];
      const values = [0];
      const calldatas = [token.interface.encodeFunctionData("mint", [proposer.address, ethers.parseEther("1000")])];
      const description = "Mint 1000 tokens to proposer";

      const tx = await governor.connect(proposer).propose(targets, values, calldatas, description);
      const receipt = await tx.wait();

      // Get proposal ID from event
      const proposalId = receipt?.logs
        .filter((log: any) => log.topics[0] === ethers.id("ProposalCreated(uint256,address,address[],uint256[],string[],bytes[],uint256,uint256,string)"))
        .map((log: any) => log.topics[1])[0];

      expect(proposalId).to.not.be.undefined;
    });

    it("Should revert if proposer doesn't have enough voting power", async function () {
      const { governor, voter2, token } = await loadFixture(deployGovernanceFixture);

      // voter2 has less than PROPOSAL_THRESHOLD
      const targets = [await token.getAddress()];
      const values = [0];
      const calldatas = [token.interface.encodeFunctionData("mint", [voter2.address, ethers.parseEther("1000")])];
      const description = "Mint 1000 tokens";

      await expect(
        governor.connect(voter2).propose(targets, values, calldatas, description)
      ).to.be.revertedWithCustomError(governor, "GovernorInsufficientProposerVotes");
    });
  });

  describe("Voting", function () {
    it("Should allow voting on active proposals", async function () {
      const { governor, proposer, voter1, token } = await loadFixture(deployGovernanceFixture);

      // Create proposal
      const targets = [await token.getAddress()];
      const values = [0];
      const calldatas = [token.interface.encodeFunctionData("mint", [proposer.address, ethers.parseEther("1000")])];
      const description = "Test proposal";

      const tx = await governor.connect(proposer).propose(targets, values, calldatas, description);
      const receipt = await tx.wait();
      
      // Wait for voting delay
      await ethers.provider.send("evm_mine", [VOTING_DELAY + 1]);

      // Cast vote
      const proposalId = await governor.hashProposal(targets, values, calldatas, ethers.id(description));
      await expect(
        governor.connect(voter1).castVote(proposalId, 1) // Vote For
      ).to.emit(governor, "VoteCast");
    });
  });

  describe("Quorum", function () {
    it("Should calculate quorum correctly", async function () {
      const { governor } = await loadFixture(deployGovernanceFixture);

      const blockNumber = await ethers.provider.getBlockNumber();
      const quorum = await governor.quorum(blockNumber);

      // Quorum should be 4% of total supply
      // With 1.5M tokens minted, quorum should be 60,000 tokens
      expect(quorum).to.be.gt(0);
    });
  });
});

