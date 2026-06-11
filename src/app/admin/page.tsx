import { getRepo, usingDatabase } from "@/lib/repo";
import { AdminRefreshButton } from "@/components/AdminRefreshButton";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  const secret = process.env.CRON_SECRET;

  if (!secret || !secret.trim()) {
    return (
      <Shell>
        <h1 className="font-display text-2xl text-neon-amber">/admin</h1>
        <p className="mt-3 text-sm text-muted">
          <code className="text-brass">CRON_SECRET</code> is not configured, so
          admin and the refresh pipeline are disabled. The app still works fully
          on the bundled seed. Set <code className="text-brass">CRON_SECRET</code>{" "}
          to enable this page.
        </p>
      </Shell>
    );
  }

  if (key !== secret) {
    return (
      <Shell>
        <h1 className="font-display text-2xl text-neon-amber">/admin</h1>
        <p className="mt-3 text-sm text-muted">
          Access denied. Append <code className="text-brass">?key=YOUR_CRON_SECRET</code>{" "}
          to the URL.
        </p>
      </Shell>
    );
  }

  const repo = getRepo();
  const venues = (await repo.getVenuesWithDeals()).filter((v) => v.dealSourceUrl);
  const log = await repo.getScrapeLog(40);
  const nameById = new Map(venues.map((v) => [v.id, v.name]));

  return (
    <Shell>
      <header className="mb-6">
        <h1 className="font-display text-2xl text-neon-amber">LAST CALL · /admin</h1>
        <p className="mt-1 text-xs text-brass">
          {usingDatabase() ? "Connected to Neon (DrizzleRepo)" : "Serving seed.json (StaticRepo)"}
          {" · "}
          {venues.length} scrapeable venues
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-sm uppercase tracking-wide text-cream">
          Venues with a source URL
        </h2>
        <ul className="space-y-2">
          {venues.map((v) => (
            <li
              key={v.id}
              className="flex flex-col gap-2 rounded-coaster border border-brass/15 bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="font-medium text-cream">{v.name}</div>
                <a
                  href={v.dealSourceUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-[11px] text-brass underline"
                >
                  {v.dealSourceUrl}
                </a>
                <div className="text-[11px] text-muted">
                  {v.deals.length} deal{v.deals.length === 1 ? "" : "s"} · last verified{" "}
                  {v.deals[0]?.lastVerified?.slice(0, 10) ?? "—"}
                </div>
              </div>
              <AdminRefreshButton slug={v.slug} adminKey={secret} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 font-display text-sm uppercase tracking-wide text-cream">
          scrape_log
        </h2>
        {log.length === 0 ? (
          <p className="text-xs text-muted">
            {usingDatabase()
              ? "No scrape runs logged yet."
              : "scrape_log requires a database (StaticRepo logs to the server console)."}
          </p>
        ) : (
          <ul className="space-y-1 font-mono text-[11px]">
            {log.map((e, i) => (
              <li key={i} className="flex gap-2 text-muted">
                <span className="text-brass">{e.ranAt.slice(0, 16).replace("T", " ")}</span>
                <span className="text-cream">{nameById.get(e.venueId) ?? e.venueId}</span>
                <span
                  className={e.status === "ok" ? "text-neon-amber" : "text-live-red"}
                >
                  {e.status}
                </span>
                {e.note && <span>· {e.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-10">{children}</main>
  );
}
