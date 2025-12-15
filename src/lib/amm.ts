import { Contract, utils, type Provider, type JsonRpcSigner, type ContractTransactionResponse } from "ethers";
import AMM_ABI from "./abi/AMM.json";

export interface Pool {
  poolId: string;
  token0: string;
  token1: string;
  reserve0: bigint;
  reserve1: bigint;
  feeBps: number;
}

export interface SwapParams {
  poolId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  minAmountOut: bigint;
  recipient: string;
  deadline: number;
}

const DEFAULT_AMM_ABI = AMM_ABI;

/**
 * Get all pools by querying PoolCreated events
 */
export async function getAllPools(
  contractAddress: string,
  provider: Provider
): Promise<Pool[]> {
  try {
    const amm = new Contract(contractAddress, DEFAULT_AMM_ABI, provider);
    const filter = amm.filters.PoolCreated();
    const events = await amm.queryFilter(filter);

    return Promise.all(
      events.map(async (event) => {
        if (!event.args) throw new Error("Event args missing");
        const { poolId, token0, token1, feeBps } = event.args;
        
        // Get pool reserves
        const pool = await amm.getPool(poolId);
        
        return {
          poolId: poolId.toString(),
          token0,
          token1,
          reserve0: pool.reserve0,
          reserve1: pool.reserve1,
          feeBps: Number(feeBps)
        };
      })
    );
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
      feeBps: Number(pool.feeBps)
    };
  } catch (error) {
    console.error(`Error getting pool ${poolId}:`, error);
    throw error;
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
  contractAddress: string,
  signer: JsonRpcSigner
): Promise<ContractTransactionResponse> {
  try {
    const amm = new Contract(contractAddress, DEFAULT_AMM_ABI, signer);
    const tx = await amm.createPool(tokenA, tokenB, amountA, amountB);
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
    const tx = await amm.addLiquidity(poolId, amount0, amount1);
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
 * Execute a swap
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
    const tx = await amm.swap(poolId, tokenIn, amountIn, minAmountOut, recipient);
    return tx;
  } catch (error) {
    console.error("Error executing swap:", error);
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
  getAllPools,
  getPool,
  createPool,
  addLiquidity,
  removeLiquidity,
  swap,
  getUserLiquidity,
};
