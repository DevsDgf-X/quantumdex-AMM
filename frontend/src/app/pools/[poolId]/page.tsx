"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";

import { networks } from "@/config/wagmi";
import { shortenAddress } from "@/lib/utils";
import {
  getPool,
  getUserLiquidity,
  addLiquidity,
  removeLiquidity,
  getTokenBalance,
  getTokenDecimals,
  getTokenSymbol,
  AMM_CONTRACT_ADDRESS,
  type PoolInfo
} from "@/lib/amm";
import { publicClientToProvider, walletClientToSigner } from "@/config/adapter";
import { formatUnits, parseUnits } from "ethers";

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
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resolvedParams, setResolvedParams] = useState<{ poolId: string } | null>(null);

  // Token metadata
  const [token0Symbol, setToken0Symbol] = useState("T0");
  const [token1Symbol, setToken1Symbol] = useState("T1");
  const [token0Decimals, setToken0Decimals] = useState(18);
  const [token1Decimals, setToken1Decimals] = useState(18);
  const [token0Balance, setToken0Balance] = useState("0");
  const [token1Balance, setToken1Balance] = useState("0");

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

        if (pool) {
          const [s0, s1, d0, d1] = await Promise.all([
            getTokenSymbol(provider, pool.token0),
            getTokenSymbol(provider, pool.token1),
            getTokenDecimals(provider, pool.token0),
            getTokenDecimals(provider, pool.token1)
          ]);
          setToken0Symbol(s0);
          setToken1Symbol(s1);
          setToken0Decimals(d0);
          setToken1Decimals(d1);

          if (address) {
            const [balance, b0, b1] = await Promise.all([
              getUserLiquidity(poolId, address, AMM_CONTRACT_ADDRESS, provider),
              getTokenBalance(provider, pool.token0, address, d0),
              getTokenBalance(provider, pool.token1, address, d1)
            ]);
            setUserLpBalance(balance);
            setToken0Balance(b0);
            setToken1Balance(b1);
          }
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

  // Handle Amount Changes with Ratio Syncing
  const onToken0AmountChange = (val: string) => {
    setToken0Amount(val);
    if (!poolInfo || poolInfo.reserve0 === BigInt(0) || !val || isNaN(parseFloat(val))) return;

    try {
      const amount0 = parseFloat(val);
      const amount1 = (amount0 * Number(poolInfo.reserve1)) / Number(poolInfo.reserve0);
      setToken1Amount(amount1.toFixed(6));
    } catch (e) {
      console.error("Error calculating ratio:", e);
    }
  };

  const onToken1AmountChange = (val: string) => {
    setToken1Amount(val);
    if (!poolInfo || poolInfo.reserve1 === BigInt(0) || !val || isNaN(parseFloat(val))) return;

    try {
      const amount1 = parseFloat(val);
      const amount0 = (amount1 * Number(poolInfo.reserve0)) / Number(poolInfo.reserve1);
      setToken0Amount(amount0.toFixed(6));
    } catch (e) {
      console.error("Error calculating ratio:", e);
    }
  };

  const handleMaxAmount0 = () => {
    onToken0AmountChange(token0Balance);
  };

  const handleMaxAmount1 = () => {
    onToken1AmountChange(token1Balance);
  };

  const handleMaxLpRemoval = () => {
    setLiquidityToRemove(formatUnits(userLpBalance, 18));
  };

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

      // Convert amounts to BigInt with correct decimals
      const amount0BigInt = parseUnits(token0Amount, token0Decimals);
      const amount1BigInt = parseUnits(token1Amount, token1Decimals);

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
        if (provider) {
          const pool = await getPool(poolId, AMM_CONTRACT_ADDRESS, provider);
          setPoolInfo(pool);
          const [balance, b0, b1] = await Promise.all([
            getUserLiquidity(poolId, address, AMM_CONTRACT_ADDRESS, provider),
            getTokenBalance(provider, pool?.token0 || "", address, token0Decimals),
            getTokenBalance(provider, pool?.token1 || "", address, token1Decimals)
          ]);
          setUserLpBalance(balance);
          setToken0Balance(b0);
          setToken1Balance(b1);
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

      const liquidityBigInt = parseUnits(liquidityToRemove, 18);

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
      if (publicClient) {
        const provider = publicClientToProvider(publicClient);
        if (provider) {
          const pool = await getPool(poolId, AMM_CONTRACT_ADDRESS, provider);
          setPoolInfo(pool);
          const balance = await getUserLiquidity(poolId, address, AMM_CONTRACT_ADDRESS, provider);
          setUserLpBalance(balance);
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
    if (!poolInfo || !token0Amount || !token1Amount || poolInfo.reserve0 === BigInt(0)) return null;

    try {
      const amount0 = parseUnits(token0Amount, token0Decimals);
      const amount1 = parseUnits(token1Amount, token1Decimals);

      // Simple calculation: min of (amount0 * totalSupply / reserve0, amount1 * totalSupply / reserve1)
      const lp0 = (amount0 * poolInfo.totalSupply) / poolInfo.reserve0;
      const lp1 = (amount1 * poolInfo.totalSupply) / poolInfo.reserve1;
      const estimated = lp0 < lp1 ? lp0 : lp1;

      return formatUnits(estimated, 18);
    } catch {
      return null;
    }
  }, [poolInfo, token0Amount, token1Amount, token0Decimals, token1Decimals]);

  // Calculate amounts to receive for remove liquidity
  const amountsToReceive = useMemo(() => {
    if (!poolInfo || !liquidityToRemove || poolInfo.totalSupply === BigInt(0)) return null;

    try {
      const liquidity = parseUnits(liquidityToRemove, 18);
      const amount0 = (liquidity * poolInfo.reserve0) / poolInfo.totalSupply;
      const amount1 = (liquidity * poolInfo.reserve1) / poolInfo.totalSupply;

      return {
        amount0: formatUnits(amount0, token0Decimals),
        amount1: formatUnits(amount1, token1Decimals),
      };
    } catch {
      return null;
    }
  }, [poolInfo, liquidityToRemove, token0Decimals, token1Decimals]);

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
                  className={`px-4 py-3 text-sm font-semibold transition ${activeTab === "add"
                      ? "border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                      : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                    }`}
                >
                  Add Liquidity
                </button>
                <button
                  onClick={() => setActiveTab("remove")}
                  className={`px-4 py-3 text-sm font-semibold transition ${activeTab === "remove"
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
                          <button className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-semibold text-zinc-500 transition hover:border-emerald-400 hover:text-emerald-500 dark:border-zinc-700">
                            Max
                          </button>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-4">
                          <input
                            type="number"
                            placeholder={isConnected ? "0.0" : "Connect wallet"}
                            disabled={!isConnected}
                            value={token0Amount}
                            onChange={(e) => setToken0Amount(e.target.value)}
                            className="flex-1 rounded-2xl border border-transparent bg-transparent text-right text-2xl font-semibold tracking-tight text-zinc-900 outline-none placeholder:text-zinc-300 dark:text-zinc-100"
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                          <span>Balance: —</span>
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
                            onChange={(e) => setToken1Amount(e.target.value)}
                            className="flex-1 rounded-2xl border border-transparent bg-transparent text-right text-2xl font-semibold tracking-tight text-zinc-900 outline-none placeholder:text-zinc-300 dark:text-zinc-100"
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                          <span>Balance: —</span>
                          <span>Reserve: {poolInfo ? (Number(poolInfo.reserve1) / 1e18).toFixed(4) : "—"}</span>
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

                  <button
                    onClick={handleAddLiquidity}
                    className="w-full rounded-2xl bg-emerald-500 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-600 disabled:bg-zinc-300 disabled:text-zinc-500"
                    disabled={!isConnected || !token0Amount || !token1Amount || txLoading || !poolInfo}
                  >
                    {txLoading ? "Adding Liquidity..." : isConnected ? "Add Liquidity" : "Connect Wallet to Add"}
                  </button>
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
                          <button className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-semibold text-zinc-500 transition hover:border-emerald-400 hover:text-emerald-500 dark:border-zinc-700">
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





