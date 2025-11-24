"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAccount, useChainId } from "wagmi";

import { networks } from "@/config/wagmi";
import { shortenAddress } from "@/lib/utils";

type PoolDetails = {
  id: string;
  pair: string;
  network: number;
  token0: string;
  token1: string;
  tvl: string;
  apr: string;
  volume24h: string;
  feeTier: string;
  reserve0: string;
  reserve1: string;
  totalSupply: string;
  utilization: string;
};

// Mock pool data - will be replaced with contract data
const mockPool: PoolDetails = {
  id: "eth-usdc-10",
  pair: "ETH / USDC",
  network: 1,
  token0: "0x0000000000000000000000000000000000000000",
  token1: "0xA0b86991c6218b36c1d19D4a2e9Eb0c3606eB48",
  tvl: "$46.1M",
  apr: "17.4%",
  volume24h: "$8.3M",
  feeTier: "0.01%",
  reserve0: "15,420.5",
  reserve1: "45,980,000",
  totalSupply: "842,150",
  utilization: "63%",
};

export default function PoolDetailsPage({ params }: { params: { poolId: string } }) {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const [activeTab, setActiveTab] = useState<"add" | "remove">("add");
  const [token0Amount, setToken0Amount] = useState("");
  const [token1Amount, setToken1Amount] = useState("");
  const [liquidityToRemove, setLiquidityToRemove] = useState("");

  const pool = useMemo(() => mockPool, []); // Will fetch from contract
  const activeNetwork = useMemo(
    () => (chainId ? networks.find((item) => item.id === chainId) : undefined),
    [chainId],
  );

  const userLpBalance = useMemo(() => {
    // Will fetch from contract
    return isConnected ? "12,450" : "0";
  }, [isConnected]);

  const handleAddLiquidity = () => {
    // Will implement contract call
    console.log("Add liquidity:", { token0Amount, token1Amount });
  };

  const handleRemoveLiquidity = () => {
    // Will implement contract call
    console.log("Remove liquidity:", liquidityToRemove);
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-14">
      <header className="flex flex-col gap-4">
        <Link href="/pools" className="text-sm font-semibold text-emerald-600 hover:text-emerald-500">
          ← Back to Pools
        </Link>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{pool.pair}</h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            Pool details, liquidity management, and trading analytics for {pool.pair} on {activeNetwork?.name ?? "Mainnet"}.
          </p>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-zinc-200/60 bg-white/80 p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/70">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-zinc-500 dark:text-zinc-400">Total Value Locked</p>
          <p className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{pool.tvl}</p>
          <p className="mt-1 text-xs text-emerald-500">+3.2% this week</p>
        </div>
        <div className="rounded-3xl border border-zinc-200/60 bg-white/80 p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/70">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-zinc-500 dark:text-zinc-400">24h Volume</p>
          <p className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{pool.volume24h}</p>
          <p className="mt-1 text-xs text-emerald-500">+5.1% vs previous</p>
        </div>
        <div className="rounded-3xl border border-zinc-200/60 bg-white/80 p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/70">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-zinc-500 dark:text-zinc-400">Est. APR</p>
          <p className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{pool.apr}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Fee tier: {pool.feeTier}</p>
        </div>
        <div className="rounded-3xl border border-zinc-200/60 bg-white/80 p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/70">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-zinc-500 dark:text-zinc-400">Your Position</p>
          <p className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {isConnected ? `${userLpBalance} LP` : "—"}
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
              <span className="text-sm font-mono text-zinc-900 dark:text-zinc-50">{shortenAddress(pool.id, 8)}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Token 0</span>
              <span className="text-sm font-mono text-zinc-900 dark:text-zinc-50">{shortenAddress(pool.token0, 6)}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Token 1</span>
              <span className="text-sm font-mono text-zinc-900 dark:text-zinc-50">{shortenAddress(pool.token1, 6)}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Reserve 0</span>
              <span className="text-sm text-zinc-900 dark:text-zinc-50">{pool.reserve0}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Reserve 1</span>
              <span className="text-sm text-zinc-900 dark:text-zinc-50">{pool.reserve1}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Total Supply</span>
              <span className="text-sm text-zinc-900 dark:text-zinc-50">{pool.totalSupply} LP</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Utilization</span>
              <span className="text-sm text-zinc-900 dark:text-zinc-50">{pool.utilization}</span>
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
                      <span>Reserve: {pool.reserve0}</span>
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
                      <span>Reserve: {pool.reserve1}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-200">Estimated LP tokens</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">—</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span>Share of pool</span>
                  <span>—</span>
                </div>
              </div>

              <button
                onClick={handleAddLiquidity}
                className="w-full rounded-2xl bg-emerald-500 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-600 disabled:bg-zinc-300 disabled:text-zinc-500"
                disabled={!isConnected || !token0Amount || !token1Amount}
              >
                {isConnected ? "Add Liquidity" : "Connect Wallet to Add"}
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
                      <span>Your balance: {isConnected ? `${userLpBalance} LP` : "—"}</span>
                      <span>Total supply: {pool.totalSupply} LP</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-200">You will receive</span>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span>Token 0</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-50">—</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Token 1</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-50">—</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleRemoveLiquidity}
                className="w-full rounded-2xl bg-rose-500 py-4 text-base font-semibold text-white shadow-lg shadow-rose-500/30 transition hover:bg-rose-600 disabled:bg-zinc-300 disabled:text-zinc-500"
                disabled={!isConnected || !liquidityToRemove}
              >
                {isConnected ? "Remove Liquidity" : "Connect Wallet to Remove"}
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

