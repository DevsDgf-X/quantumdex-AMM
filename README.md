# QuantumDEX

A decentralized exchange (DEX) and token streaming platform built for Ethereum-compatible chains. QuantumDEX combines an automated market maker (AMM) protocol with continuous payment streams, deployed on Base and Base Sepolia testnet.

## 🌟 Features

### Decentralized Exchange (AMM)
- **Permissionless Pool Creation** - Create liquidity pools for any ERC20 token pair
- **Constant Product Market Maker** - Automated pricing using the x * y = k formula
- **Flexible Liquidity Management** - Add and remove liquidity with automatic fee distribution
- **Multi-Hop Swaps** - Execute swaps across multiple pools for optimal routing
- **Flash Loans** - Borrow tokens without collateral for arbitrage and liquidations
- **Native ETH Support** - Trade ETH directly without wrapping
- **Custom Fees** - Set pool-specific fees (1-1000 basis points)

### Token Streaming Protocol
- **Continuous Payment Streams** - Time-based token distribution between parties
- **Flexible Withdrawals** - Recipients can withdraw accumulated tokens anytime
- **Stream Management** - Update parameters with dual-party consent
- **Refuel & Refund** - Add tokens to active streams or reclaim excess after completion

## 📁 Project Structure

```
quantumdex-AMM/
├── smartcontract/          # Solidity smart contracts
│   ├── contracts/          # Contract source files
│   ├── test/              # Comprehensive test suite
│   ├── scripts/           # Deployment scripts
│   └── README.md          # Smart contract documentation
│
└── frontend/              # Next.js web application
    ├── src/
    │   ├── app/           # Next.js app router pages
    │   ├── components/    # React components
    │   ├── config/        # Wagmi configuration
    │   └── lib/           # Contract ABIs and utilities
    └── README.md          # Frontend documentation
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Git
- MetaMask or compatible Web3 wallet

### Smart Contracts

```bash
# Navigate to smart contract directory
cd smartcontract

# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests (51 tests passing)
npx hardhat test

# Run tests with gas reporting
REPORT_GAS=true npx hardhat test
```

### Frontend

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🛠️ Tech Stack

### Smart Contracts
- **Solidity** ^0.8.20
- **Hardhat** - Development framework
- **OpenZeppelin** - Security-audited contract libraries
- **Ethers.js v6** - Ethereum library
- **Chai** - Testing framework

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Wagmi** - React hooks for Ethereum
- **Reown AppKit** - WalletConnect integration
- **Ethers.js** - Blockchain interactions

## 📊 Contract Features

### Security
- ✅ **Reentrancy Protection** - All state-changing functions protected
- ✅ **Minimum Liquidity Lock** - 1000 tokens locked to prevent pool drainage
- ✅ **Access Control** - Owner-only functions with OpenZeppelin Ownable
- ✅ **Input Validation** - Comprehensive checks on all parameters
- ✅ **Safe Transfers** - Protected ERC20 and ETH transfers

### Gas Optimization
- ✅ **Custom Errors** - Gas-efficient error handling
- ✅ **Storage Packing** - Optimized struct layout (uint112 + uint16)
- ✅ **Unchecked Blocks** - Safe arithmetic optimizations
- ✅ **Event Indexing** - Efficient off-chain querying

### Testing
- **51 Tests Passing** - Comprehensive coverage
- Unit tests for all functions
- Integration tests for workflows
- Edge case and security testing
- Gas optimization verification

## 🌐 Deployment

### Supported Networks
- **Base Mainnet** - Production deployment
- **Base Sepolia** - Testnet deployment

### Deploy Contracts

```bash
cd smartcontract

# Deploy to Base Sepolia (testnet)
npx hardhat run scripts/deploy-amm.ts --network baseSepolia

# Deploy to Base (mainnet)
npx hardhat run scripts/deploy-amm.ts --network base
```

### Environment Variables

**Smart Contracts** (`.env`):
```env
PRIVATE_KEY=your_private_key
BASESCAN_API_KEY=your_basescan_api_key
```

**Frontend** (`.env.local`):
```env
NEXT_PUBLIC_REOWN_PROJECT_ID=your_project_id
NEXT_PUBLIC_AMM_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_STREAMING_CONTRACT_ADDRESS=0x...
```

## 📖 Documentation

- **[Smart Contract Documentation](./smartcontract/README.md)** - Detailed contract specifications
- **[Frontend Documentation](./frontend/README.md)** - UI/UX implementation guide
- **[Smart Contract Issues](./smartcontract/ISSUES.md)** - Development roadmap and tasks
- **[Event Documentation](./smartcontract/EVENT_DOCUMENTATION.md)** - Event specifications for indexing

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Pick an Issue** - Browse [`smartcontract/ISSUES.md`](./smartcontract/ISSUES.md) or [`frontend/ISSUES.md`](./frontend/ISSUES.md)
2. **Create a Branch** - Use format: `issue/<number>-short-description`
3. **Implement Changes** - Follow the acceptance criteria
4. **Run Tests** - Ensure all tests pass
5. **Submit PR** - Include issue number in title/description

### Commit Guidelines
- Include issue number or title in commit messages
- Make atomic commits (one logical change per commit)
- Write clear, descriptive commit messages

## 🔒 Security

**⚠️ Important:** This codebase has NOT undergone a professional security audit. Use at your own risk.

### Security Features
- **Minimum Liquidity Lock** - Prevents pool drainage attacks
- **Reentrancy Guards** - Protects against reentrancy vulnerabilities
- **Checks-Effects-Interactions** - Follows best practice pattern
- **Safe Math** - Solidity 0.8+ overflow protection

### Reporting Vulnerabilities
If you discover a security vulnerability, please email [security contact] instead of opening a public issue.

## 📜 License

[Specify your license here - e.g., MIT, Apache 2.0, etc.]

## 🔗 Links

- **GitHub Repository:** https://github.com/QuantumDEX/quantumdex-AMM
- **Frontend Repository:** (Now merged into this monorepo)
- **Documentation:** See individual README files in `smartcontract/` and `frontend/`

## 📞 Support

For questions and support:
- Open an issue on GitHub
- Check existing documentation in subdirectories
- Review test files for usage examples

---

**Built with ❤️ for the decentralized future**
