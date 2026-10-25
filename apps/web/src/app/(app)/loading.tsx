/** Instant loading skeleton for app pages (shown while a server component
 * streams), so navigation never leaves a blank screen. */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="در حال بارگذاری">
      <div className="h-7 w-56 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />
        ))}
      </div>
      <div className="h-64 rounded border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />
    </div>
  );
}
