import { ethers } from "hardhat";

/**
 * Deploy QuantumDEX Governance System
 * 
 * This script deploys:
 * 1. GovernanceToken - ERC20Votes token for voting
 * 2. TimelockController - Delayed execution for proposals
 * 3. QuantumDEXGovernor - Governance contract
 * 
 * Usage:
 * npx hardhat run scripts/deploy-governance.ts --network <network>
 */

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying governance contracts with account:", deployer.address);
    console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

    // Governance parameters (adjust as needed)
    const VOTING_DELAY = 1; // 1 block delay before voting starts
    const VOTING_PERIOD = 21600; // ~3 days on Base (12s block time)
    const PROPOSAL_THRESHOLD = ethers.parseEther("1000"); // 1000 tokens needed to propose
    const QUORUM_PERCENTAGE = 4; // 4% quorum required
    const TIMELOCK_DELAY = 24 * 60 * 60; // 24 hours timelock delay (in seconds)

    // Step 1: Deploy GovernanceToken
    console.log("\n1. Deploying GovernanceToken...");
    const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
    const governanceToken = await GovernanceToken.deploy(deployer.address);
    await governanceToken.waitForDeployment();
    const governanceTokenAddress = await governanceToken.getAddress();
    console.log("GovernanceToken deployed to:", governanceTokenAddress);

    // Step 2: Deploy TimelockController
    console.log("\n2. Deploying TimelockController...");
    const TimelockController = await ethers.getContractFactory("TimelockController");
    // TimelockController constructor: (minDelay, proposers, executors, admin)
    // For initial setup, deployer is both proposer and executor
    // After Governor is deployed, we'll transfer admin to Governor
    const timelock = await TimelockController.deploy(
        TIMELOCK_DELAY,
        [deployer.address], // proposers (will be updated to include governor)
        [deployer.address], // executors (will be updated to include governor)
        deployer.address // admin (will be renounced after governor setup)
    );
    await timelock.waitForDeployment();
    const timelockAddress = await timelock.getAddress();
    console.log("TimelockController deployed to:", timelockAddress);

    // Step 3: Deploy QuantumDEXGovernor
    console.log("\n3. Deploying QuantumDEXGovernor...");
    const QuantumDEXGovernor = await ethers.getContractFactory("QuantumDEXGovernor");
    const governor = await QuantumDEXGovernor.deploy(
        governanceTokenAddress,
        timelockAddress,
        VOTING_DELAY,
        VOTING_PERIOD,
        PROPOSAL_THRESHOLD,
        QUORUM_PERCENTAGE
    );
    await governor.waitForDeployment();
    const governorAddress = await governor.getAddress();
    console.log("QuantumDEXGovernor deployed to:", governorAddress);

    // Step 4: Configure TimelockController
    console.log("\n4. Configuring TimelockController...");
    // Grant proposer role to governor
    const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
    const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
    const ADMIN_ROLE = await timelock.TIMELOCK_ADMIN_ROLE();

    const proposerTx = await timelock.grantRole(PROPOSER_ROLE, governorAddress);
    await proposerTx.wait();
    console.log("Granted PROPOSER_ROLE to Governor");

    const executorTx = await timelock.grantRole(EXECUTOR_ROLE, governorAddress);
    await executorTx.wait();
    console.log("Granted EXECUTOR_ROLE to Governor");

    // Revoke deployer's roles (governance should be autonomous)
    const revokeProposerTx = await timelock.revokeRole(PROPOSER_ROLE, deployer.address);
    await revokeProposerTx.wait();
    console.log("Revoked PROPOSER_ROLE from deployer");

    const revokeExecutorTx = await timelock.revokeRole(EXECUTOR_ROLE, deployer.address);
    await revokeExecutorTx.wait();
    console.log("Revoked EXECUTOR_ROLE from deployer");

    // Renounce admin role (timelock becomes autonomous)
    const renounceAdminTx = await timelock.revokeRole(ADMIN_ROLE, deployer.address);
    await renounceAdminTx.wait();
    console.log("Revoked ADMIN_ROLE from deployer (timelock is now autonomous)");

    console.log("\n✅ Governance system deployed successfully!");
    console.log("\n=== Deployment Summary ===");
    console.log("GovernanceToken:", governanceTokenAddress);
    console.log("TimelockController:", timelockAddress);
    console.log("QuantumDEXGovernor:", governorAddress);
    console.log("\n=== Governance Parameters ===");
    console.log("Voting Delay:", VOTING_DELAY, "blocks");
    console.log("Voting Period:", VOTING_PERIOD, "blocks (~3 days on Base)");
    console.log("Proposal Threshold:", ethers.formatEther(PROPOSAL_THRESHOLD), "tokens");
    console.log("Quorum Percentage:", QUORUM_PERCENTAGE, "%");
    console.log("Timelock Delay:", TIMELOCK_DELAY / 3600, "hours");
    console.log("\n⚠️  IMPORTANT: Distribute governance tokens before proposals can be made!");
    console.log("Use: governanceToken.mint(address, amount)");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

