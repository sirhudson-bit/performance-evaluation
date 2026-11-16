import Link from 'next/link';
import { apiData, getSession, hasPermission } from '@/lib/api';
import { PageHeader, Card, CardHeader, CardBody, Table, Td, EmptyState, StatusBadge, Badge } from '@/components/ui';
import { QuestionImportCard } from '@/components/QuestionImportCard';
import { AddQuestionDialog } from '@/components/AddQuestionDialog';
import { faDigits } from '@/lib/format';

interface Question { id: number; stableKey: string; title: string; answerType: string; status: string; weight: string; category: { name: string } | null; currentVersion: number }

const ANSWER_LABELS: Record<string, string> = {
  rating_5: 'طیف پنج‌گزینه‌ای', numeric_scale: 'طیف عددی', single_choice: 'تک‌گزینه‌ای', multi_choice: 'چندگزینه‌ای',
  percentage: 'درصد', numeric: 'عدد', short_text: 'متن کوتاه', long_text: 'متن بلند', yes_no: 'بله/خیر',
};

export default async function AdminQuestionsPage() {
  const user = await getSession();
  const canEdit = hasPermission(user, 'questions.edit');
  const [questions, categories] = await Promise.all([
    apiData<{ items: Question[] }>('/questions'),
    apiData<{ items: { id: number; name: string }[] }>('/questions/categories'),
  ]);

  return (
    <>
      <PageHeader
        title="بانک پرسش‌ها"
        description="مدیریت پرسش‌ها، دسته‌ها و نسخه‌ها"
        actions={<AddQuestionDialog categories={categories?.items ?? []} />}
      />

      <Card>
        <CardHeader
          title="پرسش‌ها"
          subtitle={`${faDigits(questions?.items.length ?? 0)} پرسش در بانک`}
        />
        {!questions || questions.items.length === 0 ? (
          <EmptyState title="پرسشی ثبت نشده است" description="با دکمه «پرسش جدید» اولین پرسش را بسازید." />
        ) : (
          <>
          <div className="hidden md:block">
          <Table head={['عنوان', 'دسته', 'نوع پاسخ', 'وزن', 'نسخه', 'وضعیت', '']}>
            {questions.items.map((q) => (
              <tr key={q.id} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                <Td>
                  <div className="min-w-[16rem]">
                    <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{q.title}</p>
                    <p dir="ltr" className="mt-0.5 truncate text-right text-[10px] text-slate-400">{q.stableKey}</p>
                  </div>
                </Td>
                <Td className="whitespace-nowrap text-xs">{q.category?.name ?? '—'}</Td>
                <Td className="whitespace-nowrap text-xs">{ANSWER_LABELS[q.answerType] ?? q.answerType}</Td>
                <Td className="tabular text-xs">{faDigits(q.weight)}</Td>
                <Td><Badge tone="muted" dot={false}>نسخه {faDigits(q.currentVersion)}</Badge></Td>
                <Td><StatusBadge group="questionStatus" value={q.status} /></Td>
                <Td>
                  {canEdit ? (
                    <Link href={`/admin/questions/${q.id}`} className="whitespace-nowrap text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
                      ویرایش گزینه‌ها
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
          </div>

          <div className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
            {questions.items.map((q) => (
              <div key={q.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{q.title}</p>
                    <p dir="ltr" className="mt-0.5 truncate text-right text-[10px] text-slate-400">{q.stableKey}</p>
                  </div>
                  <StatusBadge group="questionStatus" value={q.status} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>{q.category?.name ?? 'بدون دسته'}</span>
                  <span>· {ANSWER_LABELS[q.answerType] ?? q.answerType}</span>
                  <span>· وزن {faDigits(q.weight)}</span>
                  <Badge tone="muted" dot={false}>نسخه {faDigits(q.currentVersion)}</Badge>
                </div>
                {canEdit ? (
                  <Link href={`/admin/questions/${q.id}`} className="inline-flex text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
                    ویرایش گزینه‌ها
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
          </>
        )}
      </Card>

      {hasPermission(user, 'questions.create') ? (
        <div className="mt-6">
          <Card>
            <CardHeader
              title="افزودن گروهی پرسش‌ها از اکسل"
              subtitle="قالب شامل دسته‌های همین بانک، نوع پاسخ‌ها و ستون گزینه‌ها است؛ پیش‌نمایش پیش از ثبت"
            />
            <CardBody>
              <QuestionImportCard />
            </CardBody>
          </Card>
        </div>
      ) : null}
    </>
  );
}
