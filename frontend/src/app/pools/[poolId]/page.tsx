"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";
import { parseUnits, formatUnits } from "ethers";

import { networks } from "@/config/wagmi";
import { shortenAddress } from "@/lib/utils";
import { 
  getPool, 
  getUserLiquidity, 
  addLiquidity, 
  removeLiquidity,
  getTokenBalance,
  getTokenAllowance,
  approveToken,
  AMM_CONTRACT_ADDRESS,
  type PoolInfo 
} from "@/lib/amm";
import { publicClientToProvider, walletClientToSigner } from "@/config/adapter";

export default function PoolDetailsPage({ params }: { params: Promise<{ poolId: string }> }) {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [activeTab, setActiveTab] = useState<"add" | "remove">("add");
  const [token0Amount, setToken0Amount] = useState("");
  const [token1Amount, setToken1Amount] = useState("");
  const [liquidityToRemove, setLiquidityToRemove] = useState("");
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [userLpBalance, setUserLpBalance] = useState<bigint>(BigInt(0));
  const [token0Balance, setToken0Balance] = useState<string>("0");
  const [token1Balance, setToken1Balance] = useState<string>("0");
  const [token0Allowance, setToken0Allowance] = useState<string>("0");
  const [token1Allowance, setToken1Allowance] = useState<string>("0");
  const [token0NeedsApproval, setToken0NeedsApproval] = useState(false);
  const [token1NeedsApproval, setToken1NeedsApproval] = useState(false);
  const [approving, setApproving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resolvedParams, setResolvedParams] = useState<{ poolId: string } | null>(null);

  // Resolve params promise
  useEffect(() => {
    params.then((p) => setResolvedParams(p));
  }, [params]);

  const poolId = resolvedParams ? decodeURIComponent(resolvedParams.poolId) : "";
  const activeNetwork = useMemo(
    () => (chainId ? networks.find((item) => item.id === chainId) : undefined),
    [chainId],
  );

  // Fetch pool data
  useEffect(() => {
    const fetchPoolData = async () => {
      if (!publicClient || !AMM_CONTRACT_ADDRESS || !poolId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const provider = publicClientToProvider(publicClient);
        if (!provider) return;

        const pool = await getPool(poolId, AMM_CONTRACT_ADDRESS, provider);
        setPoolInfo(pool);

        if (address && pool) {
          const [balance, token0Bal, token1Bal] = await Promise.all([
            getUserLiquidity(poolId, address, AMM_CONTRACT_ADDRESS, provider),
            getTokenBalance(provider, pool.token0, address, 18),
            getTokenBalance(provider, pool.token1, address, 18),
          ]);
          setUserLpBalance(balance);
          setToken0Balance(token0Bal);
          setToken1Balance(token1Bal);
        }
      } catch (err) {
        console.error("Error fetching pool:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch pool data");
      } finally {
        setLoading(false);
      }
    };

    fetchPoolData();
  }, [publicClient, poolId, address]);

  // Fetch token allowances
  useEffect(() => {
    if (!isConnected || !address || !publicClient || !poolInfo || !AMM_CONTRACT_ADDRESS) {
      setToken0Allowance("0");
      setToken1Allowance("0");
      setToken0NeedsApproval(false);
      setToken1NeedsApproval(false);
      return;
    }

    const provider = publicClientToProvider(publicClient);
    if (!provider) return;

    let mounted = true;
    (async () => {
      try {
        const [allowance0, allowance1] = await Promise.all([
          getTokenAllowance(provider, poolInfo.token0, address, AMM_CONTRACT_ADDRESS),
          getTokenAllowance(provider, poolInfo.token1, address, AMM_CONTRACT_ADDRESS),
        ]);
        
        if (mounted) {
          setToken0Allowance(allowance0);
          setToken1Allowance(allowance1);
          
          // Check if approvals are needed based on current input amounts
          if (token0Amount && token1Amount) {
            try {
              const amount0BigInt = parseUnits(token0Amount, 18);
              const amount1BigInt = parseUnits(token1Amount, 18);
              setToken0NeedsApproval(BigInt(allowance0) < amount0BigInt);
              setToken1NeedsApproval(BigInt(allowance1) < amount1BigInt);
            } catch {
              setToken0NeedsApproval(false);
              setToken1NeedsApproval(false);
            }
          } else {
            setToken0NeedsApproval(false);
            setToken1NeedsApproval(false);
          }
        }
      } catch (error) {
        console.error("Error checking allowances:", error);
      }
    })();
    
    return () => {
      mounted = false;
    };
  }, [isConnected, address, publicClient, poolInfo, token0Amount, token1Amount]);

  const handleApproveToken = async (tokenAddress: string, tokenSymbol: string) => {
    if (!isConnected || !walletClient || !address || !poolInfo || !AMM_CONTRACT_ADDRESS) {
      setError("Please connect your wallet");
      return;
    }

    try {
      setApproving(true);
      setError(null);
      setSuccess(null);

      const signer = await walletClientToSigner(walletClient);
      if (!signer) {
        throw new Error("Failed to get signer");
      }

      await approveToken(signer, tokenAddress, AMM_CONTRACT_ADDRESS);
      
      setSuccess(`${tokenSymbol} approved successfully!`);
      
      // Refresh allowances
      if (publicClient && poolInfo) {
        const provider = publicClientToProvider(publicClient);
        if (provider) {
          const [newAllowance0, newAllowance1] = await Promise.all([
            getTokenAllowance(provider, poolInfo.token0, address, AMM_CONTRACT_ADDRESS),
            getTokenAllowance(provider, poolInfo.token1, address, AMM_CONTRACT_ADDRESS),
          ]);
          setToken0Allowance(newAllowance0);
          setToken1Allowance(newAllowance1);
          setToken0NeedsApproval(false);
          setToken1NeedsApproval(false);
        }
      }
    } catch (err) {
      console.error("Error approving token:", err);
      setError(err instanceof Error ? err.message : "Failed to approve token");
    } finally {
      setApproving(false);
    }
  };

  // Calculate ratio validation warning
  const ratioWarning = useMemo(() => {
    if (!poolInfo || !token0Amount || !token1Amount || poolInfo.totalSupply === BigInt(0)) {
      return null; // New pool or no amounts entered
    }

    try {
      const amount0 = parseFloat(token0Amount);
      const amount1 = parseFloat(token1Amount);
      
      if (isNaN(amount0) || isNaN(amount1) || amount0 <= 0 || amount1 <= 0) {
        return null;
      }

      const poolRatio = Number(poolInfo.reserve1) / Number(poolInfo.reserve0);
      const inputRatio = amount1 / amount0;
      
      // Allow 0.5% deviation for ratio matching
      const deviation = Math.abs(inputRatio - poolRatio) / poolRatio;
      if (deviation > 0.005) {
        const expectedAmount1 = (amount0 * poolRatio).toFixed(6);
        return `Ratio mismatch! Expected ~${expectedAmount1} token1 for ${token0Amount} token0 (pool ratio: ${poolRatio.toFixed(6)})`;
      }
    } catch {
      return null;
    }
    
    return null;
  }, [poolInfo, token0Amount, token1Amount]);

  const handleAddLiquidity = async () => {
    if (!isConnected || !walletClient || !address || !poolInfo || !AMM_CONTRACT_ADDRESS) {
      setError("Please connect your wallet");
      return;
    }

    if (!token0Amount || !token1Amount) {
      setError("Please enter amounts for both tokens");
      return;
    }

    try {
      setTxLoading(true);
      setError(null);
      setSuccess(null);

      const signer = await walletClientToSigner(walletClient);
      if (!signer) {
        throw new Error("Failed to get signer");
      }

      // Convert amounts to BigInt (assuming 18 decimals)
      const amount0BigInt = parseUnits(token0Amount, 18);
      const amount1BigInt = parseUnits(token1Amount, 18);

      // Check balances
      const balance0BigInt = parseUnits(token0Balance, 18);
      const balance1BigInt = parseUnits(token1Balance, 18);
      
      if (amount0BigInt > balance0BigInt) {
        throw new Error("Insufficient token0 balance");
      }
      if (amount1BigInt > balance1BigInt) {
        throw new Error("Insufficient token1 balance");
      }

      // Check and approve tokens if needed
      if (amount0BigInt > BigInt(token0Allowance)) {
        throw new Error("Please approve token0 first");
      }
      if (amount1BigInt > BigInt(token1Allowance)) {
        throw new Error("Please approve token1 first");
      }

      // Validate ratio for existing pools (allow 1% deviation)
      if (poolInfo.totalSupply > BigInt(0)) {
        const poolRatio = Number(poolInfo.reserve1) / Number(poolInfo.reserve0);
        const inputRatio = Number(amount1BigInt) / Number(amount0BigInt);
        const deviation = Math.abs(inputRatio - poolRatio) / poolRatio;
        
        if (deviation > 0.01) {
          throw new Error(`Ratio mismatch! Amounts must match pool ratio (${poolRatio.toFixed(6)}) within 1% tolerance`);
        }
      }

      const result = await addLiquidity(
        poolId,
        amount0BigInt,
        amount1BigInt,
        AMM_CONTRACT_ADDRESS,
        signer
      );

      await result.wait(); // Wait for transaction confirmation
      
      setSuccess(`Liquidity added successfully! Transaction: ${result.hash}`);
      
      // Reset form and refresh data
      setToken0Amount("");
      setToken1Amount("");
      
      // Refresh pool data
      if (publicClient) {
        const provider = publicClientToProvider(publicClient);
        if (provider && poolInfo) {
          const [pool, balance, token0Bal, token1Bal] = await Promise.all([
            getPool(poolId, AMM_CONTRACT_ADDRESS, provider),
            getUserLiquidity(poolId, address, AMM_CONTRACT_ADDRESS, provider),
            getTokenBalance(provider, poolInfo.token0, address, 18),
            getTokenBalance(provider, poolInfo.token1, address, 18),
          ]);
          setPoolInfo(pool);
          setUserLpBalance(balance);
          setToken0Balance(token0Bal);
          setToken1Balance(token1Bal);
        }
      }
    } catch (err) {
      console.error("Error adding liquidity:", err);
      setError(err instanceof Error ? err.message : "Failed to add liquidity");
    } finally {
      setTxLoading(false);
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!isConnected || !walletClient || !address || !poolInfo || !AMM_CONTRACT_ADDRESS) {
      setError("Please connect your wallet");
      return;
    }

    if (!liquidityToRemove) {
      setError("Please enter amount to remove");
      return;
    }

    if (BigInt(Math.floor(parseFloat(liquidityToRemove) * 1e18)) > userLpBalance) {
      setError("Insufficient LP balance");
      return;
    }

    try {
      setTxLoading(true);
      setError(null);
      setSuccess(null);

      const signer = await walletClientToSigner(walletClient);
      if (!signer) {
        throw new Error("Failed to get signer");
      }

      const liquidityBigInt = BigInt(Math.floor(parseFloat(liquidityToRemove) * 1e18));

      const result = await removeLiquidity(
        poolId,
        liquidityBigInt,
        AMM_CONTRACT_ADDRESS,
        signer
      );

      await result.wait(); // Wait for transaction confirmation
      
      setSuccess(`Liquidity removed successfully! Transaction: ${result.hash}`);
      
      // Reset form and refresh data
      setLiquidityToRemove("");
      
      // Refresh pool data
      if (publicClient && poolInfo) {
        const provider = publicClientToProvider(publicClient);
        if (provider) {
          const [pool, balance, token0Bal, token1Bal] = await Promise.all([
            getPool(poolId, AMM_CONTRACT_ADDRESS, provider),
            getUserLiquidity(poolId, address, AMM_CONTRACT_ADDRESS, provider),
            getTokenBalance(provider, poolInfo.token0, address, 18),
            getTokenBalance(provider, poolInfo.token1, address, 18),
          ]);
          setPoolInfo(pool);
          setUserLpBalance(balance);
          setToken0Balance(token0Bal);
          setToken1Balance(token1Bal);
        }
      }
    } catch (err) {
      console.error("Error removing liquidity:", err);
      setError(err instanceof Error ? err.message : "Failed to remove liquidity");
    } finally {
      setTxLoading(false);
    }
  };

  // Calculate estimated LP tokens for add liquidity
  const estimatedLpTokens = useMemo(() => {
    if (!poolInfo || !token0Amount || !token1Amount) return null;
    
    try {
      const amount0 = BigInt(Math.floor(parseFloat(token0Amount) * 1e18));
      const amount1 = BigInt(Math.floor(parseFloat(token1Amount) * 1e18));
      
      // Simple calculation: min of (amount0 * totalSupply / reserve0, amount1 * totalSupply / reserve1)
      const lp0 = (amount0 * poolInfo.totalSupply) / poolInfo.reserve0;
      const lp1 = (amount1 * poolInfo.totalSupply) / poolInfo.reserve1;
      const estimated = lp0 < lp1 ? lp0 : lp1;
      
      return (Number(estimated) / 1e18).toFixed(6);
    } catch {
      return null;
    }
  }, [poolInfo, token0Amount, token1Amount]);

  // Calculate amounts to receive for remove liquidity
  const amountsToReceive = useMemo(() => {
    if (!poolInfo || !liquidityToRemove) return null;
    
    try {
      const liquidity = BigInt(Math.floor(parseFloat(liquidityToRemove) * 1e18));
      const amount0 = (liquidity * poolInfo.reserve0) / poolInfo.totalSupply;
      const amount1 = (liquidity * poolInfo.reserve1) / poolInfo.totalSupply;
      
      return {
        amount0: (Number(amount0) / 1e18).toFixed(6),
        amount1: (Number(amount1) / 1e18).toFixed(6),
      };
    } catch {
      return null;
    }
  }, [poolInfo, liquidityToRemove]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-14">
      <header className="flex flex-col gap-4">
        <Link href="/pools" className="text-sm font-semibold text-emerald-600 hover:text-emerald-500">
          ← Back to Pools
        </Link>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {poolInfo ? `${shortenAddress(poolInfo.token0, 4)} / ${shortenAddress(poolInfo.token1, 4)}` : "Loading..."}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            Pool details, liquidity management, and trading analytics on {activeNetwork?.name ?? "Mainnet"}.
          </p>
        </div>
      </header>

      {loading ? (
        <div className="text-center py-12 text-zinc-500">Loading pool data...</div>
      ) : !poolInfo ? (
        <div className="text-center py-12 text-rose-500">Pool not found</div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-3xl border border-zinc-200/60 bg-white/80 p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/70">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-zinc-500 dark:text-zinc-400">Total Value Locked</p>
              <p className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                ${((Number(poolInfo.reserve0) + Number(poolInfo.reserve1)) / 1e18).toFixed(2)}
              </p>
            </div>
            <div className="rounded-3xl border border-zinc-200/60 bg-white/80 p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/70">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-zinc-500 dark:text-zinc-400">24h Volume</p>
              <p className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">—</p>
            </div>
            <div className="rounded-3xl border border-zinc-200/60 bg-white/80 p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/70">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-zinc-500 dark:text-zinc-400">Fee Tier</p>
              <p className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{(poolInfo.feeBps / 100).toFixed(2)}%</p>
            </div>
            <div className="rounded-3xl border border-zinc-200/60 bg-white/80 p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/70">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-zinc-500 dark:text-zinc-400">Your Position</p>
              <p className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                {isConnected ? `${(Number(userLpBalance) / 1e18).toFixed(4)} LP` : "—"}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {isConnected ? "View in Portfolio" : "Connect wallet to view"}
              </p>
            </div>
          </section>

      <section className="grid gap-6 lg:grid-cols-[2fr,3fr]">
        <div className="rounded-3xl border border-zinc-200/60 bg-white/80 p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/70">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Pool Information</h2>
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Pool ID</span>
              <span className="text-sm font-mono text-zinc-900 dark:text-zinc-50">{shortenAddress(poolId, 8)}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Token 0</span>
              <span className="text-sm font-mono text-zinc-900 dark:text-zinc-50">{shortenAddress(poolInfo.token0, 6)}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Token 1</span>
              <span className="text-sm font-mono text-zinc-900 dark:text-zinc-50">{shortenAddress(poolInfo.token1, 6)}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Reserve 0</span>
              <span className="text-sm text-zinc-900 dark:text-zinc-50">{(Number(poolInfo.reserve0) / 1e18).toFixed(4)}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Reserve 1</span>
              <span className="text-sm text-zinc-900 dark:text-zinc-50">{(Number(poolInfo.reserve1) / 1e18).toFixed(4)}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Total Supply</span>
              <span className="text-sm text-zinc-900 dark:text-zinc-50">{(Number(poolInfo.totalSupply) / 1e18).toFixed(4)} LP</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Fee</span>
              <span className="text-sm text-zinc-900 dark:text-zinc-50">{(poolInfo.feeBps / 100).toFixed(2)}%</span>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200/60 bg-white/80 p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/70">
          <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => setActiveTab("add")}
              className={`px-4 py-3 text-sm font-semibold transition ${
                activeTab === "add"
                  ? "border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              Add Liquidity
            </button>
            <button
              onClick={() => setActiveTab("remove")}
              className={`px-4 py-3 text-sm font-semibold transition ${
                activeTab === "remove"
                  ? "border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              Remove Liquidity
            </button>
          </div>

          {activeTab === "add" ? (
            <div className="mt-6 space-y-6">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.35em] text-zinc-500 dark:text-zinc-400">
                  Amount to Add
                </label>
                <div className="mt-3 space-y-4">
                  <div className="space-y-2 rounded-2xl border border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                      <span>Token 0</span>
                      <button
                        onClick={() => {
                          if (isConnected && token0Balance) {
                            setToken0Amount(token0Balance);
                            // Auto-calculate token1 amount based on pool ratio
                            if (poolInfo && poolInfo.reserve0 > 0 && poolInfo.reserve1 > 0) {
                              const ratio = Number(poolInfo.reserve1) / Number(poolInfo.reserve0);
                              const calculatedAmount1 = (parseFloat(token0Balance) * ratio).toFixed(6);
                              // Only auto-set if calculated amount is within user's balance
                              if (parseFloat(calculatedAmount1) <= parseFloat(token1Balance)) {
                                setToken1Amount(calculatedAmount1);
                              }
                            }
                          }
                        }}
                        disabled={!isConnected || !token0Balance}
                        className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-semibold text-zinc-500 transition hover:border-emerald-400 hover:text-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-700"
                      >
                        Max
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-4">
                      <input
                        type="number"
                        placeholder={isConnected ? "0.0" : "Connect wallet"}
                        disabled={!isConnected}
                        value={token0Amount}
                        onChange={(e) => {
                          setToken0Amount(e.target.value);
                          // Auto-calculate token1 amount based on pool ratio for existing pools
                          if (poolInfo && poolInfo.reserve0 > 0 && poolInfo.reserve1 > 0 && e.target.value) {
                            try {
                              const amount0 = parseFloat(e.target.value);
                              if (!isNaN(amount0) && amount0 > 0) {
                                const ratio = Number(poolInfo.reserve1) / Number(poolInfo.reserve0);
                                const calculatedAmount1 = (amount0 * ratio).toFixed(6);
                                // Only auto-set if calculated amount is within user's balance
                                if (parseFloat(calculatedAmount1) <= parseFloat(token1Balance) || !token1Balance || parseFloat(token1Balance) === 0) {
                                  setToken1Amount(calculatedAmount1);
                                }
                              }
                            } catch {
                              // Ignore invalid input
                            }
                          }
                        }}
                        className="flex-1 rounded-2xl border border-transparent bg-transparent text-right text-2xl font-semibold tracking-tight text-zinc-900 outline-none placeholder:text-zinc-300 dark:text-zinc-100"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                      <span>Balance: {isConnected ? `${token0Balance}` : "—"}</span>
                      <span>Reserve: {poolInfo ? (Number(poolInfo.reserve0) / 1e18).toFixed(4) : "—"}</span>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-2xl border border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                    <div className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Token 1</div>
                    <div className="mt-3 flex items-center justify-between gap-4">
                      <input
                        type="number"
                        placeholder={isConnected ? "0.0" : "Connect wallet"}
                        disabled={!isConnected}
                        value={token1Amount}
                        onChange={(e) => {
                          setToken1Amount(e.target.value);
                          // Auto-calculate token0 amount based on pool ratio for existing pools
                          if (poolInfo && poolInfo.reserve0 > 0 && poolInfo.reserve1 > 0 && e.target.value) {
                            try {
                              const amount1 = parseFloat(e.target.value);
                              if (!isNaN(amount1) && amount1 > 0) {
                                const ratio = Number(poolInfo.reserve0) / Number(poolInfo.reserve1);
                                const calculatedAmount0 = (amount1 * ratio).toFixed(6);
                                // Only auto-set if calculated amount is within user's balance
                                if (parseFloat(calculatedAmount0) <= parseFloat(token0Balance) || !token0Balance || parseFloat(token0Balance) === 0) {
                                  setToken0Amount(calculatedAmount0);
                                }
                              }
                            } catch {
                              // Ignore invalid input
                            }
                          }
                        }}
                        className="flex-1 rounded-2xl border border-transparent bg-transparent text-right text-2xl font-semibold tracking-tight text-zinc-900 outline-none placeholder:text-zinc-300 dark:text-zinc-100"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                      <span>Balance: {isConnected ? `${token1Balance}` : "—"}</span>
                      <span>Reserve: {poolInfo ? (Number(poolInfo.reserve1) / 1e18).toFixed(4) : "—"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {ratioWarning && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                  {ratioWarning}
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                  {success}
                </div>
              )}

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-200">Estimated LP tokens</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {estimatedLpTokens ?? "—"}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span>Share of pool</span>
                  <span>
                    {estimatedLpTokens && poolInfo
                      ? `${((parseFloat(estimatedLpTokens) / (Number(poolInfo.totalSupply) / 1e18)) * 100).toFixed(4)}%`
                      : "—"}
                  </span>
                </div>
              </div>

              {token0NeedsApproval && (
                <button
                  onClick={() => handleApproveToken(poolInfo!.token0, "Token0")}
                  className="w-full rounded-2xl bg-blue-500 py-4 text-base font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-600 disabled:bg-zinc-300 disabled:text-zinc-500"
                  disabled={!isConnected || approving || !poolInfo}
                >
                  {approving ? "Approving..." : "Approve Token0"}
                </button>
              )}
              {token1NeedsApproval && !token0NeedsApproval && (
                <button
                  onClick={() => handleApproveToken(poolInfo!.token1, "Token1")}
                  className="w-full rounded-2xl bg-blue-500 py-4 text-base font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-600 disabled:bg-zinc-300 disabled:text-zinc-500"
                  disabled={!isConnected || approving || !poolInfo}
                >
                  {approving ? "Approving..." : "Approve Token1"}
                </button>
              )}
              {!token0NeedsApproval && !token1NeedsApproval && (
                <button
                  onClick={handleAddLiquidity}
                  className="w-full rounded-2xl bg-emerald-500 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-600 disabled:bg-zinc-300 disabled:text-zinc-500"
                  disabled={!isConnected || !token0Amount || !token1Amount || txLoading || !poolInfo}
                >
                  {txLoading ? "Adding Liquidity..." : isConnected ? "Add Liquidity" : "Connect Wallet to Add"}
                </button>
              )}
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.35em] text-zinc-500 dark:text-zinc-400">
                  Amount to Remove
                </label>
                <div className="mt-3 space-y-4">
                  <div className="space-y-2 rounded-2xl border border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                      <span>LP Tokens</span>
                      <button
                        onClick={() => {
                          if (isConnected && userLpBalance > BigInt(0)) {
                            setLiquidityToRemove((Number(userLpBalance) / 1e18).toFixed(6));
                          }
                        }}
                        disabled={!isConnected || userLpBalance === BigInt(0)}
                        className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-semibold text-zinc-500 transition hover:border-emerald-400 hover:text-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-700"
                      >
                        Max
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-4">
                      <input
                        type="number"
                        placeholder={isConnected ? "0.0" : "Connect wallet"}
                        disabled={!isConnected}
                        value={liquidityToRemove}
                        onChange={(e) => setLiquidityToRemove(e.target.value)}
                        className="flex-1 rounded-2xl border border-transparent bg-transparent text-right text-2xl font-semibold tracking-tight text-zinc-900 outline-none placeholder:text-zinc-300 dark:text-zinc-100"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                      <span>Your balance: {isConnected ? `${(Number(userLpBalance) / 1e18).toFixed(4)} LP` : "—"}</span>
                      <span>Total supply: {poolInfo ? `${(Number(poolInfo.totalSupply) / 1e18).toFixed(4)} LP` : "—"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                  {success}
                </div>
              )}

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-200">You will receive</span>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span>Token 0</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                      {amountsToReceive?.amount0 ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Token 1</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                      {amountsToReceive?.amount1 ?? "—"}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleRemoveLiquidity}
                className="w-full rounded-2xl bg-rose-500 py-4 text-base font-semibold text-white shadow-lg shadow-rose-500/30 transition hover:bg-rose-600 disabled:bg-zinc-300 disabled:text-zinc-500"
                disabled={!isConnected || !liquidityToRemove || txLoading || !poolInfo}
              >
                {txLoading ? "Removing Liquidity..." : isConnected ? "Remove Liquidity" : "Connect Wallet to Remove"}
              </button>
            </div>
          )}
        </div>
      </section>
        </>
      )}
    </main>
  );
}





