'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/client';
import { Input, Button, Badge } from '@/components/ui';

interface Result {
  total: number;
  articles: { slug: string; title: string; summary: string | null }[];
  faqs: { id: number; question: string; answer: string }[];
  glossary: { id: number; term: string; definition: string }[];
}

export function HelpSearch() {
  const [q, setQ] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (q.trim().length < 2) {
      setResult(null);
      return;
    }
    setBusy(true);
    try {
      const res = await apiClient<Result>('GET', `/help/search?q=${encodeURIComponent(q.trim())}`);
      setResult(res);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={search} className="flex gap-2">
        <label htmlFor="help-q" className="sr-only">جستجو در راهنما</label>
        <Input id="help-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو در راهنما، پرسش‌های متداول و واژه‌نامه" />
        <Button type="submit" disabled={busy}>{busy ? '…' : 'جستجو'}</Button>
      </form>

      {q.trim().length === 1 ? <p className="text-sm text-slate-500">حداقل دو حرف وارد کنید.</p> : null}

      {result ? (
        result.total === 0 ? (
          <p className="text-sm text-slate-500">نتیجه‌ای یافت نشد.</p>
        ) : (
          <div className="space-y-3 text-sm">
            {result.articles.map((a) => (
              <div key={a.slug}><Badge tone="info">راهنما</Badge> <span className="font-medium">{a.title}</span></div>
            ))}
            {result.faqs.map((f) => (
              <div key={f.id}><Badge tone="warning">پرسش</Badge> <span className="font-medium">{f.question}</span> — <span className="text-slate-500">{f.answer}</span></div>
            ))}
            {result.glossary.map((g) => (
              <div key={g.id}><Badge tone="muted">واژه</Badge> <span className="font-medium">{g.term}</span> — <span className="text-slate-500">{g.definition}</span></div>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
