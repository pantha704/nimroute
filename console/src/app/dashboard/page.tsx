import KeysTable from "@/components/dashboard/keys-table";
import UsagePanel from "@/components/dashboard/usage-panel";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold">NimRoute Console</h1>
          <p className="text-sm text-zinc-500">
            Managed OpenAI-compatible LLM gateway. Cheap NIM models, tenant keys, metered usage.
          </p>
        </header>

        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            API keys
          </h2>
          <KeysTable />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Usage & cost
          </h2>
          <UsagePanel />
        </section>
      </div>
    </main>
  );
}
