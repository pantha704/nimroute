export default function DocsPage() {
  const baseExamples = [
    {
      title: "List models",
      code: `curl https://api.nimroute.dev/v1/models \\
  -H "Authorization: Bearer nr_live_..."`,
    },
    {
      title: "Chat completion",
      code: `curl https://api.nimroute.dev/v1/chat/completions \\
  -H "Authorization: Bearer nr_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "deepseek-v4-flash",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`,
    },
    {
      title: "Tracking usage",
      code: `curl https://console.nimroute.dev/api/usage \\
  -H "Cookie: session=..."    # or view in the dashboard`,
    },
  ];

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Quickstart</h1>
        <p className="mt-2 text-sm text-zinc-400">
          NimRoute is an OpenAI-compatible API. Point any OpenAI SDK at it by
          overriding the base URL and API key.
        </p>

        <section className="mt-8 space-y-6">
          {baseExamples.map((ex) => (
            <div key={ex.title}>
              <h2 className="mb-2 text-sm font-medium">{ex.title}</h2>
              <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-xs text-zinc-300">
                <code>{ex.code}</code>
              </pre>
            </div>
          ))}
        </section>

        <section className="mt-10 rounded-lg border border-amber-900/50 bg-amber-950/30 p-4 text-sm text-amber-200">
          <strong>Note:</strong> this is the NimRoute beta. Create an API key from
          the dashboard. Billing is a Razorpay subscription (placeholder until plan IDs
          are configured). Metered usage reports once LiteLLM spend logging is enabled.
        </section>
      </div>
    </main>
  );
}
