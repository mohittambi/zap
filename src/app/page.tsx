async function getApiReachable(): Promise<{ ok: boolean; detail: string }> {
  const origin =
    process.env.NEXT_PUBLIC_API_URL?.trim()?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  try {
    const res = await fetch(`${origin}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      cache: "no-store",
    });
    if (res.status === 400) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return {
        ok: true,
        detail: data.error ?? "API reachable",
      };
    }
    return { ok: true, detail: `API responded with status ${res.status}` };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : "Could not reach API",
    };
  }
}

export default async function Home() {
  const status = await getApiReachable();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-zinc-50 px-6 font-sans dark:bg-black">
      <main className="flex max-w-lg flex-col gap-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Zap
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Next.js app with API routes under{" "}
          <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-sm dark:bg-zinc-800">
            /api
          </code>
          . Set{" "}
          <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-sm dark:bg-zinc-800">
            DATABASE_URL
          </code>{" "}
          and{" "}
          <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-sm dark:bg-zinc-800">
            JWT_SECRET
          </code>{" "}
          (see{" "}
          <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-sm dark:bg-zinc-800">
            .env.local.example
          </code>
          {")."}
        </p>
        <div
          className={`rounded-lg border px-4 py-3 text-left text-sm ${
            status.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
              : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
          }`}
        >
          <p className="font-medium">
            {status.ok ? "API connection" : "API unreachable"}
          </p>
          <p className="mt-1 opacity-90">{status.detail}</p>
          {!status.ok && (
            <p className="mt-2 text-xs opacity-80">
              Run{" "}
              <code className="rounded bg-black/10 px-1 dark:bg-white/10">
                npm run dev
              </code>{" "}
              with Postgres configured, or check{" "}
              <code className="rounded bg-black/10 px-1 dark:bg-white/10">
                DATABASE_URL
              </code>
              .
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
