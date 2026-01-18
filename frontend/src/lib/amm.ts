import {
  Contract,
  type Provider,
  type JsonRpcSigner,
  type ContractTransactionResponse,
  formatUnits,
  isAddress,
  getAddress,
} from "ethers";
import AMM_ABI from "./abi/AMM.json";

// Minimal ERC20 ABI for basic token interactions
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

// Export contract address from environment variable
export const AMM_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_AMM_CONTRACT_ADDRESS || "";

export interface Pool {
  poolId: string;
  token0: string;
  token1: string;
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
  feeBps: number;
}

// Alias for Pool interface (used in some components)
export type PoolInfo = Pool;

// Event interface for PoolCreated events
export interface PoolCreatedEvent {
  poolId: string;
  token0: string;
  token1: string;
  feeBps: number;
  blockNumber?: number;
  txHash?: string;
}

const DEFAULT_AMM_ABI = AMM_ABI;

export function normalizeAddress(address: string): string {
  const trimmed = address.trim();
  if (!isAddress(trimmed)) {
    throw new Error(`Invalid address: ${address}`);
  }
  return getAddress(trimmed);
}

export function sortTokenAddresses(tokenA: string, tokenB: string): { token0: string; token1: string } {
  const a = normalizeAddress(tokenA);
  const b = normalizeAddress(tokenB);
  if (a.toLowerCase() === b.toLowerCase()) {
    throw new Error("Token addresses must be different");
  }

  // Deterministic ordering: token0 < token1 by numeric address.
  return BigInt(a) < BigInt(b) ? { token0: a, token1: b } : { token0: b, token1: a };
}

export async function getDefaultFeeBps(contractAddress: string, provider: Provider): Promise<number> {
  const amm = new Contract(contractAddress, DEFAULT_AMM_ABI, provider);
  const fee = await amm.defaultFeeBps();
  return Number(fee);
}


/**
 * Get all pools by querying PoolCreated events
 */
export async function getAllPools(
  contractAddress: string,
  provider: Provider
): Promise<PoolCreatedEvent[]> {
  try {
    const amm = new Contract(contractAddress, DEFAULT_AMM_ABI, provider);
    const filter = amm.filters.PoolCreated();
    const events = await amm.queryFilter(filter);

    return events.map((event) => {
      // Cast to any to avoid "args does not exist" TS error on Log | EventLog union
      const e = event as any;
      if (!e.args) throw new Error("Event args missing");
      const { poolId, token0, token1, feeBps } = e.args;

      return {
        poolId: poolId.toString(),
        token0,
        token1,
        feeBps: Number(feeBps),
        blockNumber: event.blockNumber,
        txHash: event.transactionHash
      };
    });
  } catch (error) {
    console.error("Error getting all pools:", error);
    throw error;
  }
}

/**
 * Get pool data by poolId
 */
export async function getPool(
  poolId: string,
  contractAddress: string,
  provider: Provider
): Promise<Pool | null> {
  try {
    const amm = new Contract(contractAddress, DEFAULT_AMM_ABI, provider);
    const pool = await amm.getPool(poolId);

    if (!pool || pool.token0 === "0x0000000000000000000000000000000000000000") {
      return null;
    }

    return {
      poolId,
      token0: pool.token0,
      token1: pool.token1,
      reserve0: pool.reserve0,
      reserve1: pool.reserve1,
      totalSupply: pool.totalSupply,
      feeBps: Number(pool.feeBps)
    };
  } catch (error) {
    console.error(`Error getting pool ${poolId}:`, error);
    throw error;
  }
}

/**
 * Get Pool ID for a token pair and fee tier
 */
export async function getPoolId(
  tokenA: string,
  tokenB: string,
  feeBps: number,
  contractAddress: string,
  provider: Provider
): Promise<string> {
  try {
    const amm = new Contract(contractAddress, DEFAULT_AMM_ABI, provider);
    return await amm.getPoolId(tokenA, tokenB, feeBps);
  } catch (error) {
    console.error("Error getting pool ID:", error);
    throw error;
  }
}

/**
 * ERC20: Get Token Balance
 */
export async function getTokenBalance(
  provider: Provider,
  tokenAddress: string,
  userAddress: string,
  decimals: number = 18
): Promise<string> {
  try {
    if (tokenAddress === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") {
      const balance = await provider.getBalance(userAddress);
      return formatUnits(balance, decimals);
    }
    const token = new Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await token.balanceOf(userAddress);
    return formatUnits(balance, decimals);
  } catch (error) {
    console.error(`Error getting balance for ${tokenAddress}:`, error);
    return "0";
  }
}

/**
 * ERC20: Get Token Allowance
 */
export async function getTokenAllowance(
  provider: Provider,
  tokenAddress: string,
  owner: string,
  spender: string
): Promise<string> {
  try {
    if (tokenAddress === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") return "115792089237316195423570985008687907853269984665640564039457584007913129639935"; // Max Uint256 for ETH if used
    const token = new Contract(tokenAddress, ERC20_ABI, provider);
    const allowance = await token.allowance(owner, spender);
    return allowance.toString();
  } catch (error) {
    console.error("Error getting allowance:", error);
    return "0";
  }
}

/**
 * ERC20: Get Token Decimals
 */
/**
 * ERC20: Get Token Decimals
 */
export async function getTokenDecimals(
  provider: Provider,
  tokenAddress: string
): Promise<number> {
  try {
    if (tokenAddress === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") return 18;
    const token = new Contract(tokenAddress, ERC20_ABI, provider);
    const decimals = await token.decimals();
    return Number(decimals);
  } catch (error) {
    console.error(`Error getting decimals for ${tokenAddress}:`, error);
    return 18; // Default to 18
  }
}

/**
 * ERC20: Get Token Symbol
 */
export async function getTokenSymbol(
  provider: Provider,
  tokenAddress: string
): Promise<string> {
  try {
    if (tokenAddress === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") return "ETH";
    const token = new Contract(tokenAddress, ERC20_ABI, provider);
    return await token.symbol();
  } catch (error) {
    console.error(`Error getting symbol for ${tokenAddress}:`, error);
    return "TOKEN";
  }
}

/**
 * ERC20: Approve Token
 */
export async function approveToken(
  signer: JsonRpcSigner,
  tokenAddress: string,
  spender: string
): Promise<ContractTransactionResponse> {
  try {
    const token = new Contract(tokenAddress, ERC20_ABI, signer);
    const tx = await token.approve(spender, "115792089237316195423570985008687907853269984665640564039457584007913129639935"); // Max Uint256
    return tx;
  } catch (error) {
    console.error("Error approving token:", error);
    throw error;
  }
}

/**
 * Get Quote (Simulation using Reserves)
 */
export async function getQuote(
  provider: Provider,
  contractAddress: string,
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  decimalsIn: number,
  decimalsOut: number,
  feeBps: number = 30, // Default 0.3%
  factoryAddress?: string // Unused, but kept for compatibility with call site
): Promise<bigint | null> {
  try {
    // 1. Get Pool ID
    const poolId = await getPoolId(tokenIn, tokenOut, feeBps, contractAddress, provider);

    // 2. Get Pool Data
    const pool = await getPool(poolId, contractAddress, provider);
    if (!pool) return null;

    // 3. Calculate Output Amount (Constant Product Formula with Fee)
    // dy = (dx * 997 * y) / (x * 1000 + dx * 997) for 0.3% fee
    // Note: This matches the contract's getAmountOut logic usually
    const amountInBigInt = BigInt(Math.floor(parseFloat(amountIn) * (10 ** decimalsIn)));

    let reserveIn, reserveOut;
    // Check which token is which in the pair to determine reserves
    // Note: getPool returns token0/token1/reserve0/reserve1.
    // We need to match tokenIn with token0 or token1.
    if (tokenIn.toLowerCase() === pool.token0.toLowerCase()) {
      reserveIn = pool.reserve0;
      reserveOut = pool.reserve1;
    } else {
      reserveIn = pool.reserve1;
      reserveOut = pool.reserve0;
    }

    if (reserveIn === BigInt(0) || reserveOut === BigInt(0)) return BigInt(0);

    // AmountIn with fee
    // If fee is 30 bps (0.3%), we multiply by (10000 - 30) = 9970 then divide by 10000
    const feeMultiplier = BigInt(10000 - feeBps);
    const amountInWithFee = amountInBigInt * feeMultiplier;
    const numerator = amountInWithFee * reserveOut;
    const denominator = (reserveIn * BigInt(10000)) + amountInWithFee;

    return numerator / denominator;
  } catch (error) {
    console.error("Error getting quote:", error);
    return null;
  }
}

/**
 * Create a new pool
 */
export async function createPool(
  tokenA: string,
  tokenB: string,
  amountA: bigint,
  amountB: bigint,
  feeBps: number,
  contractAddress: string,
  signer: JsonRpcSigner
): Promise<ContractTransactionResponse> {
  try {
    const amm = new Contract(contractAddress, DEFAULT_AMM_ABI, signer);

    // Calculate msg.value if either token is native ETH
    let value = BigInt(0);
    if (tokenA === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") value = amountA;
    if (tokenB === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") value = amountB;

    const tx = await amm.createPool(tokenA, tokenB, amountA, amountB, feeBps, { value });
    return tx;
  } catch (error) {
    console.error("Error creating pool:", error);
    throw error;
  }
}

/**
 * Add liquidity to a pool
 */
export async function addLiquidity(
  poolId: string,
  amount0: bigint,
  amount1: bigint,
  contractAddress: string,
  signer: JsonRpcSigner
): Promise<ContractTransactionResponse> {
  try {
    const amm = new Contract(contractAddress, DEFAULT_AMM_ABI, signer);

    // Check if either token in the pool is native ETH to set msg.value
    const pool = await getPool(poolId, contractAddress, signer.provider!);
    let value = BigInt(0);
    if (pool) {
      if (pool.token0 === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") value = amount0;
      if (pool.token1 === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") value = amount1;
    }

    const tx = await amm.addLiquidity(poolId, amount0, amount1, { value });
    return tx;
  } catch (error) {
    console.error("Error adding liquidity:", error);
    throw error;
  }
}

/**
 * Remove liquidity from a pool
 */
export async function removeLiquidity(
  poolId: string,
  liquidity: bigint,
  contractAddress: string,
  signer: JsonRpcSigner
): Promise<ContractTransactionResponse> {
  try {
    const amm = new Contract(contractAddress, DEFAULT_AMM_ABI, signer);
    const tx = await amm.removeLiquidity(poolId, liquidity);
    return tx;
  } catch (error) {
    console.error("Error removing liquidity:", error);
    throw error;
  }
}

/**
 * Execute a swap (Direct Pool Interaction)
 */
export async function swap(
  poolId: string,
  tokenIn: string,
  amountIn: bigint,
  minAmountOut: bigint,
  recipient: string,
  contractAddress: string,
  signer: JsonRpcSigner
): Promise<ContractTransactionResponse> {
  try {
    const amm = new Contract(contractAddress, DEFAULT_AMM_ABI, signer);

    // Set msg.value if tokenIn is native ETH
    const value = tokenIn === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" ? amountIn : BigInt(0);

    const tx = await amm.swap(poolId, tokenIn, amountIn, minAmountOut, recipient, { value });
    return tx;
  } catch (error) {
    console.error("Error executing swap:", error);
    throw error;
  }
}

/**
 * Execute a multi-hop swap
 */
export async function swapMultiHop(
  path: string[],
  poolIds: string[],
  amountIn: bigint,
  minAmountOut: bigint,
  recipient: string,
  contractAddress: string,
  signer: JsonRpcSigner
): Promise<ContractTransactionResponse> {
  try {
    const amm = new Contract(contractAddress, DEFAULT_AMM_ABI, signer);

    // Set msg.value if the first token in path is native ETH
    const value = path[0] === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" ? amountIn : BigInt(0);

    const tx = await amm.swapMultiHop(path, poolIds, amountIn, minAmountOut, recipient, { value });
    return tx;
  } catch (error) {
    console.error("Error executing multi-hop swap:", error);
    throw error;
  }
}

/**
 * Execute a swap by finding the pool first (Helper for UI)
 * Renamed to avoid overload conflict, but we export 'swap' and this as separate functions.
 * The SwapPage calls amm.swap with many args, we might need to fix SwapPage to call this.
 */
export async function swapTokens(
  signer: JsonRpcSigner,
  contractAddress: string,
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  minAmountOut: string,
  recipient: string,
  feeBps: number = 30
): Promise<ContractTransactionResponse> {
  try {
    // We need a provider to read the poolId
    const provider = signer.provider;
    if (!provider) throw new Error("Signer must have a provider");

    const poolId = await getPoolId(tokenIn, tokenOut, feeBps, contractAddress, provider);

    const amountInBigInt = BigInt(amountIn);
    const minAmountOutBigInt = BigInt(minAmountOut);

    return swap(poolId, tokenIn, amountInBigInt, minAmountOutBigInt, recipient, contractAddress, signer);
  } catch (error) {
    console.error("Error executing swapTokens:", error);
    throw error;
  }
}

/**
 * Get user's liquidity in a pool
 */
export async function getUserLiquidity(
  poolId: string,
  userAddress: string,
  contractAddress: string,
  provider: Provider
): Promise<bigint> {
  try {
    const amm = new Contract(contractAddress, DEFAULT_AMM_ABI, provider);
    const balance = await amm.getLpBalance(poolId, userAddress);
    return balance;
  } catch (error) {
    console.error("Error getting user liquidity:", error);
    throw error;
  }
}

// Export all functions as default object
export default {
  normalizeAddress,
  sortTokenAddresses,
  getDefaultFeeBps,
  getTokenDecimals,
  getAllPools,
  getPool,
  getPoolId,
  createPool,
  addLiquidity,
  removeLiquidity,
  swap,
  swapMultiHop,
  swapTokens,
  getUserLiquidity,
  getTokenBalance,
  getTokenAllowance,
  getTokenDecimals,
  getTokenSymbol,
  approveToken,
  getQuote,
};
