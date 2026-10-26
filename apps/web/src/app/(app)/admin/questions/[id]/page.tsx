import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiData, getSession, hasPermission } from '@/lib/api';
import { PageHeader, Card, CardHeader, CardBody, Alert, Badge, StatusBadge } from '@/components/ui';
import { QuestionForm, type QuestionInitial } from '@/components/AdminForms';
import { faDigits } from '@/lib/format';

interface QuestionPayload {
  question: {
    id: number;
    stableKey: string;
    title: string;
    text: string;
    answerType: string;
    weight: string;
    status: string;
    currentVersion: number;
    categoryId: number | null;
    category: { id: number; name: string } | null;
    options: { id: number; label: string; value: string; score: string | null; sortOrder: number }[];
    versions: { id: number; version: number; createdAt: string }[];
  };
}

const ANSWER_LABELS: Record<string, string> = {
  rating_5: 'طیف پنج‌گزینه‌ای',
  numeric_scale: 'طیف عددی',
  single_choice: 'تک‌گزینه‌ای',
  multi_choice: 'چندگزینه‌ای',
  percentage: 'درصد',
  numeric: 'عدد',
  short_text: 'متن کوتاه',
  long_text: 'متن بلند',
  yes_no: 'بله/خیر',
};

/** Per-question editor: metadata, answer type and the option list. */
export default async function AdminQuestionEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  if (!hasPermission(user, 'questions.edit')) {
    return (
      <>
        <PageHeader title="ویرایش پرسش" />
        <Alert variant="danger">برای ویرایش پرسش به دسترسی «ویرایش بانک پرسش» نیاز دارید.</Alert>
      </>
    );
  }

  const [data, categories] = await Promise.all([
    apiData<QuestionPayload>(`/questions/${id}`),
    apiData<{ items: { id: number; name: string }[] }>('/questions/categories'),
  ]);
  if (!data) notFound();
  const q = data.question;

  const initial: QuestionInitial = {
    id: q.id,
    stableKey: q.stableKey,
    title: q.title,
    text: q.text,
    answerType: q.answerType,
    weight: q.weight,
    categoryId: q.categoryId,
    status: q.status,
    options: q.options.map((o) => ({ label: o.label, value: o.value, score: o.score })),
  };

  return (
    <>
      <PageHeader
        title={`ویرایش پرسش: ${q.title}`}
        description="تغییر متن، نوع پاسخ و گزینه‌ها. هر ذخیره، نسخه جدیدی می‌سازد."
        actions={<Link href="/admin/questions" className="text-sm text-brand-700 hover:underline dark:text-brand-300">بازگشت به بانک پرسش‌ها</Link>}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="تنظیمات پرسش" subtitle="گزینه‌ها را می‌توانید ویرایش، حذف یا اضافه کنید." />
          <CardBody>
            <QuestionForm categories={categories?.items ?? []} initial={initial} />
          </CardBody>
        </Card>

        <aside className="space-y-4">
          <Card>
            <CardHeader title="وضعیت نسخه‌ها" />
            <CardBody className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="muted">v{faDigits(q.currentVersion)}</Badge>
                <StatusBadge group="questionStatus" value={q.status} />
                {q.category ? <Badge tone="info">{q.category.name}</Badge> : null}
                <Badge tone="muted">{ANSWER_LABELS[q.answerType] ?? q.answerType}</Badge>
              </div>
              <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
                ویرایش یک پرسش، نسخه تازه‌ای ثبت می‌کند؛ فرم‌ها و نتایج قبلی به نسخه زمان خودشان متصل می‌مانند و تغییر نمی‌کنند.
              </p>
              <ul className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                {(q.versions ?? []).slice(0, 6).map((v) => (
                  <li key={v.id}>نسخه {faDigits(v.version)} — {new Date(v.createdAt).toLocaleDateString('fa-IR')}</li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="گزینه‌های فعلی" subtitle={`${faDigits(q.options.length)} گزینه`} />
            <CardBody>
              <ol className="space-y-2 text-sm">
                {q.options.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-100 px-3 py-2 dark:border-slate-800">
                    <span className="break-words">{o.label}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400" dir="ltr">{o.value}{o.score !== null ? ` · ${o.score}` : ''}</span>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
