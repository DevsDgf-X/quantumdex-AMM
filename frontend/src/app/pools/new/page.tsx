"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { parseUnits } from "ethers";
import {
  AMM_CONTRACT_ADDRESS,
  approveToken,
  createPool,
  getDefaultFeeBps,
  getPoolId,
  getTokenAllowance,
  getTokenDecimals,
  sortTokenAddresses,
} from "@/lib/amm";
import { publicClientToProvider, walletClientToSigner } from "@/config/adapter";

const launchChecklist = [
  "Token contracts verified and decimals confirmed",
  "Sufficient liquidity prepared for both assets",
  "Price oracle monitoring configured",
  "On-chain analytics alerts subscribed",
];

export default function CreatePoolPage() {
  const { isConnected, address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const router = useRouter();
  
  const [token0, setToken0] = useState("");
  const [token1, setToken1] = useState("");
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [defaultFeeBps, setDefaultFeeBps] = useState<number | null>(null);
  const [resolvedPoolId, setResolvedPoolId] = useState<string | null>(null);

  // Read the AMM's default fee bps for display + deterministic poolId.
  // Note: current AMM contract uses defaultFeeBps (not user-selectable).
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!publicClient || !AMM_CONTRACT_ADDRESS) return;
      const provider = publicClientToProvider(publicClient);
      if (!provider) return;
      try {
        const fee = await getDefaultFeeBps(AMM_CONTRACT_ADDRESS, provider);
        if (mounted) setDefaultFeeBps(fee);
      } catch (e) {
        console.warn("Failed to read defaultFeeBps", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [publicClient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected || !walletClient || !address) {
      setError("Please connect your wallet");
      return;
    }

    if (!token0 || !token1 || !amount0 || !amount1) {
      setError("Please fill in all fields");
      return;
    }

    if (!AMM_CONTRACT_ADDRESS) {
      setError("Contract address not configured");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      setResolvedPoolId(null);

      // Deterministic token ordering.
      const sorted = sortTokenAddresses(token0, token1);

      const signer = await walletClientToSigner(walletClient);
      if (!signer) {
        throw new Error("Failed to get signer");
      }

      const provider = signer.provider;
      if (!provider) {
        throw new Error("Wallet provider not available");
      }

      // Fee tier is currently defaultFeeBps (not user-selectable).
      const feeBps = defaultFeeBps ?? (await getDefaultFeeBps(AMM_CONTRACT_ADDRESS, provider));

      // Resolve decimals and parse amounts correctly.
      const [decimals0, decimals1] = await Promise.all([
        getTokenDecimals(provider, sorted.token0),
        getTokenDecimals(provider, sorted.token1),
      ]);

      const amount0BigInt = parseUnits(amount0, decimals0);
      const amount1BigInt = parseUnits(amount1, decimals1);

      // Compute poolId deterministically for UI display/redirect.
      const poolId = await getPoolId(sorted.token0, sorted.token1, feeBps, AMM_CONTRACT_ADDRESS, provider);
      setResolvedPoolId(poolId);

      // Ensure approvals for both tokens before pool creation.
      const [allowance0, allowance1] = await Promise.all([
        getTokenAllowance(provider, sorted.token0, address, AMM_CONTRACT_ADDRESS),
        getTokenAllowance(provider, sorted.token1, address, AMM_CONTRACT_ADDRESS),
      ]);

      if (BigInt(allowance0) < amount0BigInt) {
        const approveTx = await approveToken(signer, sorted.token0, AMM_CONTRACT_ADDRESS);
        await approveTx.wait();
      }
      if (BigInt(allowance1) < amount1BigInt) {
        const approveTx = await approveToken(signer, sorted.token1, AMM_CONTRACT_ADDRESS);
        await approveTx.wait();
      }

      const result = await createPool(
        sorted.token0,
        sorted.token1,
        amount0BigInt,
        amount1BigInt,
        AMM_CONTRACT_ADDRESS,
        signer
      );

      await result.wait();
      setSuccess(`Pool created successfully! Pool ID: ${poolId}. Transaction: ${result.hash}`);

      // Redirect to the pool details page.
      setTimeout(() => {
        router.push(`/pools/${encodeURIComponent(poolId)}`);
      }, 1200);
    } catch (err) {
      console.error("Error creating pool:", err);
      setError(err instanceof Error ? err.message : "Failed to create pool");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-6 py-14">
      <header className="flex flex-col gap-3">
        <Link href="/pools" className="text-sm font-semibold text-emerald-600 hover:text-emerald-500">
          ← Back to Pools
        </Link>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Create a Liquidity Pool</h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            Deploy a concentrated liquidity pool with deterministic token ordering and professional-grade defaults.
          </p>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[3fr,2fr]">
        <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-zinc-200/60 bg-white/80 p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/70">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.35em] text-zinc-500 dark:text-zinc-400">
              Token Pair
            </label>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Token 0</span>
                <input
                  type="text"
                  placeholder="0x... (token address)"
                  value={token0}
                  onChange={(e) => setToken0(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 focus:border-emerald-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-100"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Token 1</span>
                <input
                  type="text"
                  placeholder="0x... (token address)"
                  value={token1}
                  onChange={(e) => setToken1(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 focus:border-emerald-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-100"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Addresses are sorted automatically to ensure deterministic pool deployments.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.35em] text-zinc-500 dark:text-zinc-400">
              Initial Price
            </label>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Price Token0 / Token1</span>
                <input
                  type="number"
                  placeholder="e.g. 0.000056"
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 focus:border-emerald-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-100"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Price Token1 / Token0</span>
                <input
                  type="number"
                  placeholder="Auto calculated"
                  disabled
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950/40"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.35em] text-zinc-500 dark:text-zinc-400">
              Fee Tier
            </label>
            <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-950/40">
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                {defaultFeeBps === null ? "Loading..." : `${(defaultFeeBps / 100).toFixed(2)}%`}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Fee is read from the AMM contract’s default and is not user-selectable.
              </p>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.35em] text-zinc-500 dark:text-zinc-400">
              Minimum Liquidity
            </label>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Token0 Amount</span>
                <input
                  type="number"
                  placeholder="e.g. 100"
                  value={amount0}
                  onChange={(e) => setAmount0(e.target.value)}
                  step="0.000000000000000001"
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 focus:border-emerald-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-100"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Token1 Amount</span>
                <input
                  type="number"
                  placeholder="e.g. 120,000"
                  value={amount1}
                  onChange={(e) => setAmount1(e.target.value)}
                  step="0.000000000000000001"
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 focus:border-emerald-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-100"
                />
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

          {resolvedPoolId && !success && (
            <div className="rounded-2xl border border-zinc-200 bg-white/60 p-4 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950/30 dark:text-zinc-300">
              Pool ID (computed): {resolvedPoolId}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-2xl bg-emerald-500 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-600 disabled:bg-zinc-300 disabled:text-zinc-500"
            disabled={!isConnected || loading}
          >
            {loading ? "Creating Pool..." : isConnected ? "Deploy Pool" : "Connect Wallet to Deploy"}
          </button>
        </form>

        <aside className="flex flex-col gap-4 rounded-3xl border border-zinc-200/60 bg-white/80 p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/70">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Launch Checklist</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Ensure the following items are complete prior to submitting on mainnet. Test deployments on a testnet first.
          </p>
          <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
            {launchChecklist.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 text-emerald-500">✔</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/70 p-4 text-xs text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
            Need white-glove support? Contact institutional@quantumdex.xyz for deployment guidance and custom liquidity mining.
          </div>
        </aside>
      </section>
    </main>
  );
}

