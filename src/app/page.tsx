export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.4em] text-brass">
        Chicago · Happy Hour Radar
      </p>
      <h1 className="neon-amber neon-flicker mt-4 font-display text-6xl leading-none sm:text-8xl">
        LAST CALL
      </h1>
      <p className="mt-6 max-w-sm font-body text-sm text-muted">
        Every live drink deal around you, ranked by Steal Score and counting
        down in real time.
      </p>
      <div className="brass-rule mt-10 w-40" />
      <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-muted">
        booting the radar…
      </p>
    </main>
  );
}
