'use client';

import { useState } from 'react';
import { cn } from '@pe/ui';

/** Tabs that switch between the form wizard and the cycle wizard. The wizards
 * are passed in as elements (serializable) from the server page. */
export function WizardTabs({ form, cycle }: { form: React.ReactNode; cycle: React.ReactNode }) {
  const [tab, setTab] = useState<'form' | 'cycle'>('form');
  const tabs = [
    { key: 'form' as const, label: 'فرم ارزیابی' },
    { key: 'cycle' as const, label: 'دوره ارزیابی' },
  ];
  return (
    <div>
      <div role="tablist" aria-label="نوع ایجاد" className="mb-5 inline-flex rounded border border-slate-200 p-1 dark:border-slate-700">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'rounded px-4 py-1.5 text-sm transition-colors',
              tab === t.key ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div key={tab} className="animate-fade-in">
        {tab === 'form' ? form : cycle}
      </div>
    </div>
  );
}
