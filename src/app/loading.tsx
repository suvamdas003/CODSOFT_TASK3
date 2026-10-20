export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="animate-pulse space-y-4">
        <div className="h-7 w-56 rounded bg-slate-200" />
        <div className="h-4 w-80 max-w-full rounded bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-200" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-slate-200" />
      </div>
    </div>
  );
}
