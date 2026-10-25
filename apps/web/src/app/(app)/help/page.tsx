import { apiData } from '@/lib/api';
import { PageHeader, Card, CardHeader, EmptyState, Badge } from '@/components/ui';
import { HelpSearch } from '@/components/HelpSearch';
import { TourLauncher } from '@/components/tours';

interface HelpData {
  articles: { id: number; slug: string; title: string; summary: string | null; body: string }[];
  faqs: { id: number; question: string; answer: string; category: string | null }[];
  glossary: { id: number; term: string; definition: string }[];
}

export default async function HelpPage() {
  const help = await apiData<HelpData>('/help');

  return (
    <>
      <PageHeader title="راهنما" description="راهنمای گام‌به‌گام، پرسش‌های متداول و واژه‌نامه" />

      <Card className="mb-6">
        <CardHeader title="جستجو در راهنما" />
        <div className="p-5">
          <HelpSearch />
        </div>
      </Card>

      <Card className="mb-6">
        <CardHeader title="تورهای آموزشی گام‌به‌گام" subtitle="راهنمای تعاملی برای هر بخش — قابل اجرا با صفحه‌کلید و قابل تکرار" />
        <div className="p-5">
          <TourLauncher />
          <p className="mt-3 text-xs text-slate-500">هر تور عناصر واقعی همان صفحه را نشان می‌دهد و اگر بخشی در دسترس نباشد، آن گام را رد می‌کند.</p>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="راهنمای گام‌به‌گام" />
          {!help || help.articles.length === 0 ? (
            <EmptyState title="مقاله‌ای ثبت نشده است" />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {help.articles.map((a) => (
                <article key={a.id} className="p-5">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">{a.title}</h3>
                  {a.summary ? <p className="mt-1 text-sm text-slate-500">{a.summary}</p> : null}
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">{a.body}</div>
                </article>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="پرسش‌های متداول" />
            {!help || help.faqs.length === 0 ? (
              <EmptyState title="پرسشی ثبت نشده است" />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {help.faqs.map((f) => (
                  <li key={f.id} className="p-5">
                    <details>
                      <summary className="cursor-pointer font-medium text-slate-800 dark:text-slate-200">{f.question}</summary>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{f.answer}</p>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="واژه‌نامه" />
            {!help || help.glossary.length === 0 ? (
              <EmptyState title="واژه‌ای ثبت نشده است" />
            ) : (
              <dl className="divide-y divide-slate-100 dark:divide-slate-800">
                {help.glossary.map((g) => (
                  <div key={g.id} className="flex gap-3 p-5">
                    <dt><Badge tone="info">{g.term}</Badge></dt>
                    <dd className="text-sm leading-6 text-slate-600">{g.definition}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
