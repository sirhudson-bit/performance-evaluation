import Link from 'next/link';

/** Shared shell for the legal pages (public — no session required). */
export function LegalShell({ title, version, children }: { title: string; version: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
        <Link href="/" className="text-sm text-brand-700 hover:underline">صفحه اصلی</Link>
      </div>
      <p className="mb-8 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-800">
        این متن یک پیش‌نویس مبتنی بر رفتار واقعی سامانه است و «مشاوره حقوقی» نیست. اطلاعات هویتی کسب‌وکار که با
        <span className="mx-1 font-medium">[نیازمند تأیید کسب‌وکار]</span>
        مشخص شده‌اند، باید توسط مالک کسب‌وکار تکمیل شوند. نسخه: {version}.
      </p>
      <article className="space-y-6 text-sm leading-7 text-slate-700 dark:text-slate-300">{children}</article>
    </main>
  );
}

export function BusinessField({ label }: { label: string }) {
  return (
    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">[نیازمند تأیید کسب‌وکار: {label}]</span>
  );
}
