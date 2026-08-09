import Link from "next/link";

export default function Landing() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <nav className="mb-16 flex items-center justify-between">
          <span className="text-lg font-semibold">NimRoute</span>
          <div className="flex items-center gap-4 text-sm text-zinc-400">
            <Link href="/docs" className="hover:text-zinc-200">
              Docs
            </Link>
            <Link href="/dashboard" className="hover:text-zinc-200">
              Dashboard
            </Link>
          </div>
        </nav>

        <section className="mb-12">
          <h1 className="text-4xl font-bold leading-tight">
            Cheap, routed LLM inference.
            <br />
            <span className="text-indigo-400">One OpenAI-compatible API.</span>
          </h1>
          <p className="mt-4 max-w-xl text-zinc-400">
            NimRoute gives you a single endpoint that routes each prompt to the
            cheapest capable NVIDIA NIM model — DeepSeek V4 Flash, GLM 5.2, and more —
            with automatic fallback, tenant API keys, and per-token cost visibility.
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              href="/dashboard"
              className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Get an API key
            </Link>
            <Link
              href="/docs"
              className="rounded-md border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:border-zinc-500"
            >
              Quickstart docs
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            ["Metered", "Pay per token, no hidden fees. Benchmarked routing."],
            ["Failsafe", "Automatic fallback if a model degrades or rate-limits."],
            ["Observable", "Per-key usage and cost right in the console."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
              <p className="font-medium">{t}</p>
              <p className="mt-1 text-sm text-zinc-400">{d}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
