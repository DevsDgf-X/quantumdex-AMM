import { cookieStorage, createStorage } from "@wagmi/core";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import {
  base,
  baseSepolia,
} from "@reown/appkit/networks";

export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;

if (!projectId) {
  throw new Error("NEXT_PUBLIC_REOWN_PROJECT_ID is required to initialize AppKit");
}

// Primary networks: Base and Base Sepolia
export const networks = [base, baseSepolia];

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

