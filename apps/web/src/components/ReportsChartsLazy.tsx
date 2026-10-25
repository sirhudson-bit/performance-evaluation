'use client';

import dynamic from 'next/dynamic';

/**
 * Recharts is the heaviest client dependency in the app and is only needed once
 * a page has data to chart. Loading it through `next/dynamic` keeps it out of
 * the route's initial JavaScript; the skeleton reserves the chart's height so
 * nothing shifts when it arrives.
 */
export const ReportsChartsLazy = dynamic(() => import('./ReportsCharts').then((mod) => mod.ReportsCharts), {
  ssr: false,
  loading: () => (
    <div className="grid gap-6 lg:grid-cols-2" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-72 animate-pulse rounded border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800/60" />
      ))}
    </div>
  ),
});
