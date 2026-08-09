"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";

interface UsageData {
  totals: { tokensIn: number; tokensOut: number; cost: number; requests: number };
  daily: { date: string; tokensIn: number; tokensOut: number; cost: number; requests: number }[];
  cacheHitRate: number | null;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(Math.round(n));
}

export default function UsagePanel() {
  const { data: session } = useSession();
  const [data, setData] = useState<UsageData | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/usage")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null));
  }, [session]);

  if (!session?.user) return null;

  const cards = [
    { label: "Tokens in", value: data ? fmt(data.totals.tokensIn) : "—" },
    { label: "Tokens out", value: data ? fmt(data.totals.tokensOut) : "—" },
    { label: "Est. cost", value: data ? `$${data.totals.cost.toFixed(2)}` : "—" },
    { label: "Syncs", value: data ? String(data.totals.requests) : "—" },
  ];

  const maxDay =
    data && data.daily.length
      ? Math.max(...data.daily.map((d) => d.tokensIn + d.tokensOut))
      : 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-xs text-zinc-500">{c.label}</p>
            <p className="mt-1 text-xl font-semibold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium">Daily tokens (input + output)</p>
          <span className="text-xs text-zinc-500">
            {data?.daily.length ? "usage-sync" : "waiting for usage-sync to run"}
          </span>
        </div>
        {data && data.daily.length > 0 ? (
          <div className="flex items-end gap-1 h-28">
            {data.daily.slice(-14).map((d) => {
              const tot = d.tokensIn + d.tokensOut;
              const h = Math.max(4, (tot / maxDay) * 100);
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-indigo-500/70"
                    style={{ height: `${h}%` }}
                    title={`${d.date}: ${fmt(tot)} tokens`}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-zinc-500">
            No usage yet. The hourly usage-sync worker will populate this once
            LiteLLM spend logging is enabled.
          </p>
        )}
        <p className="mt-2 text-xs text-zinc-600">
          Note: current nim-router LiteLLM returns 500 on /global/spend/logs, so this
          panel fills once spend DB logging is configured. The plumbing + UI is ready.
        </p>
      </div>
    </div>
  );
}
