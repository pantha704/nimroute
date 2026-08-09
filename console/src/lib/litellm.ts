/**
 * LiteLLM admin API client for the NimRoute console.
 * Talks to the private LiteLLM admin API (Tailscale-only, never public).
 * Covers team + virtual-key lifecycle and spend ingestion.
 */
import type { Plan } from "@prisma/client";

interface LitellmAdmin {
  baseURL: string;
  masterKey: string;
}

export function getLitellmAdmin(): LitellmAdmin {
  const baseURL = process.env.LITELLM_BASE_URL ?? "http://localhost:4000";
  const masterKey = process.env.LITELLM_MASTER_KEY ?? "";
  if (!masterKey) {
    throw new Error("LITELLM_MASTER_KEY is not configured");
  }
  return { baseURL, masterKey };
}

function headers(admin: LitellmAdmin, contentType = true): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${admin.masterKey}`,
  };
  if (contentType) h["Content-Type"] = "application/json";
  return h;
}

async function request<T>(
  path: string,
  init: RequestInit,
  admin?: LitellmAdmin,
): Promise<T> {
  const a = admin ?? getLitellmAdmin();
  const res = await fetch(`${a.baseURL}${path}`, {
    ...init,
    headers: { ...headers(a), ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LiteLLM ${init.method ?? "GET"} ${path} failed ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/** Plan -> monthly budget ceiling (USD). Mirrors console plan pricing. */
export function planBudget(plan: Plan): number {
  switch (plan) {
    case "HOBBY":
      return 20;
    case "PRO":
      return 100;
    case "ENTERPRISE":
      return 300;
    default:
      return 20;
  }
}

export interface TeamId {
  team_id?: string;
  team_alias?: string;
}

/** Create a team owned by a user (1:1 in v1). */
export async function createTeamForUser(userId: string, plan: Plan): Promise<string> {
  const data = await request<TeamId>("/team/new", {
    method: "POST",
    body: JSON.stringify({
      team_alias: `user_${userId}`,
      max_budget: planBudget(plan),
    }),
  });
  const id = data.team_id;
  if (!id) throw new Error("LiteLLM did not return team_id");
  return id;
}

export interface GeneratedKey {
  key: string;
  /** LiteLLM returns the id inside `token_id` (not `key_id`). */
  key_id?: string;
  token_id?: string;
  team_id?: string;
}

/** Generate a virtual API key bound to a team; returns the full key ONCE. */
export async function createVirtualKey(
  teamId: string,
  name: string,
  budget?: number,
): Promise<GeneratedKey> {
  const res = await request<GeneratedKey>("/key/generate", {
    method: "POST",
    body: JSON.stringify({
      team_id: teamId,
      key_alias: name,
      ...(budget !== undefined ? { max_budget: budget } : {}),
    }),
  });
  // LiteLLM calls the persistent key identifier `token_id`; normalize it.
  if (!res.key_id && res.token_id) res.key_id = res.token_id;
  return res;
}

/** Revoke a virtual key (existing keys stay valid until TTL; new calls 401). */
export async function revokeVirtualKey(keyId: string): Promise<void> {
  await request<{ message?: string }>("/key/delete", {
    method: "POST",
    body: JSON.stringify({ key_ids: [keyId] }),
  });
}

export interface LitellmKeyInfo {
  key_id?: string;
  key_alias?: string;
  team_id?: string;
  budget?: number | null;
  token?: string;
  last_updated_at?: string;
  created_at?: string;
}

/** List keys belonging to a team. */
export async function listTeamKeys(teamId: string): Promise<LitellmKeyInfo[]> {
  const data = await request<{ keys?: LitellmKeyInfo[] }>(
    `/key/list?team_id=${encodeURIComponent(teamId)}`,
    { method: "GET" },
  );
  return (data.keys ?? []).map((k) =>
    !k.key_id && "token_id" in (k as Record<string, unknown>)
      ? { ...k, key_id: (k as unknown as { token_id?: string }).token_id }
      : k,
  );
}

export interface SpendLogItem {
  model?: string;
  api_key?: string;
  team_id?: string;
  spend?: number;
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  startTime?: string;
  /** Daily-aggregate shape from LiteLLM: { date, spend } per day */
  date?: string;
}

export interface SpendLogsResponse {
  data?: SpendLogItem[] | null;
  total_spend?: number;
}

/**
 * Pull spend for a team within [from, to] (ISO strings).
 * LiteLLM returns a daily-aggregate array of { date, spend }; we sum spend
 * into a single cost figure. Token counts are not in the aggregate — the
 * per-request rows live under /spend/key/logs. We return cost + the raw
 * rows so the usage-sync worker can store metered cost.
 */
export async function getTeamSpend(
  teamId: string,
  from: string,
  to: string,
): Promise<SpendLogsResponse> {
  const qs = new URLSearchParams({
    team_id: teamId,
    start_date: from,
    end_date: to,
  });
  const data = await request<unknown[]>(`/global/spend/logs?${qs.toString()}`, {
    method: "GET",
  });
  const rows = (Array.isArray(data) ? data : []) as SpendLogItem[];
  const totalSpend = rows.reduce((sum, r) => sum + (r.spend ?? 0), 0);
  return { data: rows, total_spend: totalSpend };
}

/** Quick health check against the LiteLLM proxy. */
export async function litellmHealthy(base?: string): Promise<boolean> {
  const a = { baseURL: base ?? (getLitellmAdmin().baseURL), masterKey: "" };
  try {
    const res = await fetch(`${a.baseURL}/health/liveliness`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}
