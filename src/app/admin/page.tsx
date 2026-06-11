import { getRepo, usingDatabase } from "@/lib/repo";
import { AdminRefreshButton } from "@/components/AdminRefreshButton";
import { AdminBatchButton } from "@/components/AdminBatchButton";
import type { Lifecycle } from "@/lib/types";

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
          on the bundled census + seed. Set{" "}
          <code className="text-brass">CRON_SECRET</code> to enable this page.
        </p>
      </Shell>
    );
  }
  if (key !== secret) {
    return (
      <Shell>
        <h1 className="font-display text-2xl text-neon-amber">/admin</h1>
        <p className="mt-3 text-sm text-muted">
          Access denied. Append{" "}
          <code className="text-brass">?key=YOUR_CRON_SECRET</code> to the URL.
        </p>
      </Shell>
    );
  }

  const repo = getRepo();
  const all = await repo.getVenuesWithDeals();
  const inRadius = all.filter(
    (v) => v.distanceFromHqM != null && v.distanceFromHqM <= 3219
  );
  const counts: Record<Lifecycle, number> = {
    UNSCOUTED: 0,
    SCOUTED: 0,
    EXTRACTED: 0,
    NO_DEAL_FOUND: 0,
  };
  for (const v of inRadius) counts[v.lifecycle]++;
  const total = inRadius.length || 1;
  const dealsFound = all.reduce((n, v) => n + v.deals.length, 0);
  const scoutedPct = Math.round(
    ((counts.SCOUTED + counts.EXTRACTED + counts.NO_DEAL_FOUND) / total) * 100
  );
  const extractedPct = Math.round((counts.EXTRACTED / total) * 100);

  const scoutable = all
    .filter((v) => v.dealSourceUrl)
    .sort((a, b) => a.lifecycle.localeCompare(b.lifecycle))
    .slice(0, 30);
  const log = await repo.getScrapeLog(40);
  const nameById = new Map(all.map((v) => [v.id, v.name]));

  return (
    <Shell>
      <header className="mb-5">
        <h1 className="font-display text-2xl text-neon-amber">LAST CALL · coverage</h1>
        <p className="mt-1 text-xs text-brass">
          {usingDatabase() ? "Neon (DrizzleRepo)" : "seed + census (StaticRepo)"} ·{" "}
          {inRadius.length} venues in the 2-mile ring
        </p>
      </header>

      {/* Coverage bars */}
      <section className="mb-6 space-y-3">
        <Bar label="Scouted" pct={scoutedPct} />
        <Bar label="Extracted (deals found)" pct={extractedPct} live />
        <div className="tabular grid grid-cols-4 gap-2 text-center text-[11px]">
          <Stat n={counts.UNSCOUTED} label="unscouted" />
          <Stat n={counts.SCOUTED} label="scouted" />
          <Stat n={counts.EXTRACTED} label="extracted" />
          <Stat n={dealsFound} label="deals" />
        </div>
      </section>

      <section className="mb-6">
        {usingDatabase() ? (
          <AdminBatchButton adminKey={secret} />
        ) : (
          <p className="rounded-coaster border border-brass/15 bg-surface p-3 text-[12px] text-muted">
            Batch runs persist results, which needs a database. Set{" "}
            <code className="text-brass">DATABASE_URL</code> + run{" "}
            <code className="text-brass">pnpm db:seed</code> to enable. Locally
            you can still <code className="text-brass">pnpm scout</code> /{" "}
            <code className="text-brass">pnpm scrape</code>.
          </p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-sm uppercase tracking-wide text-cream">
          Venues with a source URL
        </h2>
        <ul className="space-y-2">
          {scoutable.map((v) => (
            <li
              key={v.id}
              className="flex flex-col gap-2 rounded-coaster border border-brass/15 bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="font-medium text-cream">
                  {v.name}{" "}
                  <span className="text-[10px] uppercase tracking-wide text-brass">
                    {v.lifecycle}
                  </span>
                </div>
                <a
                  href={v.dealSourceUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-[11px] text-brass underline"
                >
                  {v.dealSourceUrl}
                </a>
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
              ? "No runs logged yet — hit “Run next batch”."
              : "scrape_log requires a database (StaticRepo logs to the server console)."}
          </p>
        ) : (
          <ul className="space-y-1 font-mono text-[11px]">
            {log.map((e, i) => (
              <li key={i} className="flex flex-wrap gap-2 text-muted">
                <span className="text-brass">
                  {e.ranAt.slice(0, 16).replace("T", " ")}
                </span>
                <span className="text-neon-amber/70">[{e.step}]</span>
                <span className="text-cream">{nameById.get(e.venueId) ?? e.venueId}</span>
                <span className={e.status === "ok" ? "text-neon-amber" : "text-live-red"}>
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

function Bar({ label, pct, live }: { label: string; pct: number; live?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[12px]">
        <span className="text-cream">{label}</span>
        <span className="tabular text-brass">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full ${live ? "bg-live-red" : "bg-neon-amber"}`}
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-coaster bg-surface py-2">
      <div className="font-display text-base text-cream">{n}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto min-h-dvh max-w-2xl px-5 py-10">{children}</main>;
}
