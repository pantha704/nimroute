#!/usr/bin/env node
/**
 * Live E2E test of the NimRoute core loop against a real LiteLLM gateway.
 * Mirrors exactly what src/lib/litellm.ts does (team/new -> key/generate -> call /v1).
 * Uses the master key from the running nim-router gateway on :4000.
 *
 * Usage: node e2e-live-test.mjs "http://127.0.0.1:4000" "MASTER_KEY"
 */
const base = process.argv[2] ?? "http://127.0.0.1:4000";
const master = process.argv[3];
if (!master) {
  console.error("Usage: node e2e-live-test.mjs <baseURL> <LITELLM_MASTER_KEY>");
  process.exit(1);
}

const H = { "Content-Type": "application/json", Authorization: `Bearer ${master}` };
const suffix = Date.now().toString(36);
console.log(`Testing gateway: ${base}`);

async function main() {
  // 1) models
  const models = await fetch(`${base}/v1/models`, { headers: H, cache: "no-store" });
  const modelsBody = await models.json();
  console.log(`[1] /v1/models -> ${models.status}, served=${(modelsBody.data ?? []).length}`);

  // 2) create team (this is what the signup hook does)
  const teamRes = await fetch(`${base}/team/new`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ team_alias: `user_test_${suffix}`, max_budget: 20 }),
    cache: "no-store",
  });
  const teamBody = await teamRes.json();
  const teamId = teamBody.team_id;
  console.log(`[2] /team/new -> ${teamRes.status}, team_id=${teamId ?? "NONE"}`);
  if (!teamId) {
    console.error("  BODY:", JSON.stringify(teamBody).slice(0, 300));
    process.exit(2);
  }

  // 3) generate a virtual key bound to the team (this is what POST /api/keys does)
  const keyRes = await fetch(`${base}/key/generate`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ team_id: teamId, key_alias: `test_key_${suffix}`, max_budget: 20 }),
    cache: "no-store",
  });
  const keyBody = await keyRes.json();
  const fullKey = keyBody.key;
  console.log(`[3] /key/generate -> ${keyRes.status}, key=${fullKey ? fullKey.slice(0, 16) + "…" : "NONE"}`);
  if (!fullKey) {
    console.error("  BODY:", JSON.stringify(keyBody).slice(0, 300));
    process.exit(3);
  }

  // 4) call the gateway WITH the virtual key (proves a customer's key works end-to-end)
  const chatRes = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${fullKey}` },
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      messages: [{ role: "user", content: "Reply with exactly: nimroute-live" }],
      max_tokens: 32,
    }),
    cache: "no-store",
  });
  const chatBody = await chatRes.json();
  const reply =
    chatBody?.choices?.[0]?.message?.content ?? chatBody?.error?.message ?? JSON.stringify(chatBody).slice(0, 200);
  console.log(`[4] /v1/chat/completions with VIRTUAL KEY -> ${chatRes.status}`);
  console.log(`    reply: ${reply}`);

  // 5) cleanup — delete the test key + team
  try {
    await fetch(`${base}/key/delete`, {
      method: "POST", headers: H, body: JSON.stringify({ key_ids: [keyBody.key_id] }), cache: "no-store",
    });
    await fetch(`${base}/team/delete`, {
      method: "POST", headers: H, body: JSON.stringify({ team_ids: [teamId] }), cache: "no-store",
    });
    console.log("[5] cleanup: key + team deleted");
  } catch (e) {
    console.log("[5] cleanup skipped:", e.message);
  }

  const ok = chatRes.ok && chatBody?.choices?.[0]?.message?.content === "nimroute-live";
  console.log(`\nRESULT: ${ok ? "PASS ✅ core loop works end-to-end" : "NEEDS REVIEW ⚠️"}`);
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
