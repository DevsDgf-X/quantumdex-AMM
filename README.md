# QuantumDEX — Frontend

A modern Next.js frontend for QuantumDEX - a decentralized exchange and token streaming platform. Built with TypeScript, Tailwind CSS, and ethers.js/wagmi for Ethereum-compatible chains.

## Overview

QuantumDEX is a dual-platform DeFi protocol offering two main features:

### Decentralized Exchange (DEX)
- **Swapping tokens** across liquidity pools
- **Managing liquidity** by adding/removing from pools
- **Creating new pools** for token pairs
- **Viewing pool statistics** and user positions

### Token Streaming
- **Creating payment streams** between parties
- **Continuous token distribution** over time
- **Withdrawing accumulated tokens** at any time
- **Managing stream parameters** with dual-party consent

Built for Ethereum-compatible chains, with primary deployment on Base and Base Sepolia testnet.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Web3:** ethers.js, wagmi, Reown AppKit (WalletConnect)
- **State Management:** React Hooks

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Development

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Build for production
npm run build
```

## Project Structure

```
src/
├── app/              # Next.js app router pages
│   ├── swap/        # Token swap interface (DEX)
│   ├── pools/       # Pool management pages (DEX)
│   ├── streams/     # Token streaming interface
│   └── portfolio/   # User position tracking
├── components/       # React components
├── config/          # Wagmi and adapter configuration
├── lib/             # Utilities and contract helpers
│   ├── abi/         # Contract ABIs
│   ├── amm.ts       # AMM contract interaction functions
│   └── streaming.ts # Token streaming contract functions
└── hooks/           # Custom React hooks
```

## Contributing

We welcome contributions! To get started:

1. **Pick an issue** from [`ISSUES.md`](./ISSUES.md)
2. **Create a branch** using the issue number: `issue/<number>-short-description`
3. **Implement your changes** following the issue's acceptance criteria
4. **Submit a PR** with the issue number in the title/description

When pushing your changes, include the issue number or title in your commit messages.

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_REOWN_PROJECT_ID=your_project_id
NEXT_PUBLIC_AMM_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_STREAMING_CONTRACT_ADDRESS=0x...
```

**Note:** Contract addresses will be provided after deployment to Base Sepolia (testnet) or Base (mainnet).

## License

See the main project LICENSE file.
