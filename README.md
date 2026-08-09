# NimRoute

Metered, OpenAI-compatible **LLM routing SaaS**. A product surface around LiteLLM:
tenant API keys, Stripe metered billing, and a usage dashboard — so anyone can use
cheap NVIDIA NIM models (DeepSeek V4 Flash, GLM 5.2, DeepSeek V4 Pro, MiniMax M3)
with automatic fallback, per-team budgets, and per-token cost.

## Architecture

```
Caddy (TLS)
 ├─ api.nimroute.dev    → LiteLLM :4000   (OpenAI-compatible /v1/*)
 └─ console.nimroute.dev → console :3000  (Next.js control plane)
       Docker network: litellm · postgres:16 · redis:7 · console
```

- **LiteLLM** routes models + fails over + logs spend. Two DBs: `litellm` (keys/teams/spend)
  and (console) `nimroute` (users/billing/usage-sync).
- **Admin surfaces** (LiteLLM admin API, Postgres, Redis) are Tailscale-only — never public.

## Stack
- Console: Next.js 15 (App Router) · TypeScript · Prisma 6 + Postgres · better-auth · Razorpay · QStash · zustand
- Gateway: LiteLLM (`ghcr.io/berriai/litellm:main-stable`) · Postgres 16 · Redis 7

## Known env wiring
Razorpay subscriptions power the plan fee; per-token usage is metered from LiteLLM
spend logs via the QStash usage-sync worker (`UsageSync` rows feed the cost dashboard).
Set `RAZORPAY_*_PLAN_ID` (Hobby/Pro/Enterprise) once you create the plans in the dashboard.

## Quick start (dev)
```bash
cp .env.example nimroute.env   # fill in keys
docker compose up -d --build
# verify gateway
curl http://localhost:4000/v1/models -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

## Roadmap (ruflo-generated)
1. Signup → auto-provision team + virtual key via LiteLLM admin API (core loop) — DONE
2. Razorpay subscription billing + QStash usage-sync metering — DONE
3. Console dashboard (keys, per-key usage, cost-per-model, budget meter, cache hit-rate)
4. Landing + pricing + docs quickstart
5. Redis cache (per-team namespaced) → semantic cache (phase 2)

Plans: **Hobby $19/mo · Pro $99/mo · Scale $299/mo** (flat seat + pure metered tokens).
