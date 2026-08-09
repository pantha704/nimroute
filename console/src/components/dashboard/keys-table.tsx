"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";

interface ApiKeyInfo {
  id: string;
  keyId: string;
  name: string;
  prefix: string;
  revokedAt: string | null;
  createdAt: string;
  budget: number;
}

export default function KeysTable() {
  const { data: session } = useSession();
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [name, setName] = useState("Default key");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await fetch("/api/keys");
      const d = await r.json();
      setKeys(Array.isArray(d.keys) ? d.keys : []);
    } catch {
      setError("Failed to load keys");
    }
  };

  useEffect(() => {
    if (session?.user) load();
  }, [session]);

  const create = async () => {
    setLoading(true);
    setError(null);
    setNewKey(null);
    try {
      const r = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const d = await r.json();
      if (d.key) setNewKey(`sk-${d.key}`);
      else setError(d.error?.message ?? "Create failed");
      load();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const revoke = async (keyId: string) => {
    await fetch(`/api/keys?keyId=${keyId}`, { method: "DELETE" });
    load();
  };

  if (!session?.user) {
    return <p className="text-sm text-zinc-500">Sign in to manage API keys.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">Key name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm w-56"
            placeholder="my-app-prod"
          />
        </div>
        <button
          onClick={create}
          disabled={loading}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create key"}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {newKey && (
        <div className="rounded-md border border-emerald-700 bg-emerald-950/40 p-4">
          <p className="text-xs font-semibold text-emerald-400 mb-1">
            Your API key — copy it now, shown only once:
          </p>
          <code className="block break-all rounded bg-black/50 px-3 py-2 text-sm text-emerald-300">
            {newKey}
          </code>
        </div>
      )}

      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-xs text-zinc-400">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Key</th>
              <th className="px-4 py-2">Budget</th>
              <th className="px-4 py-2">Created</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {keys.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                  No API keys yet. Create one to get started.
                </td>
              </tr>
            )}
            {keys.map((k) => (
              <tr key={k.id} className="hover:bg-zinc-900/50">
                <td className="px-4 py-2 font-medium">{k.name}</td>
                <td className="px-4 py-2 font-mono text-xs text-zinc-400">{k.prefix}…</td>
                <td className="px-4 py-2">${k.budget.toFixed(2)}</td>
                <td className="px-4 py-2 text-xs text-zinc-400">
                  {new Date(k.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                      k.revokedAt ? "bg-red-950 text-red-300" : "bg-emerald-950 text-emerald-300"
                    }`}
                  >
                    {k.revokedAt ? "revoked" : "active"}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {!k.revokedAt && (
                    <button
                      onClick={() => revoke(k.keyId)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
