import Link from 'next/link';
import { apiData, getSession, hasPermission } from '@/lib/api';
import { PageHeader, Card, CardHeader, CardBody, Table, Td, EmptyState, StatusBadge, Badge } from '@/components/ui';
import { QuestionForm } from '@/components/AdminForms';

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
      <PageHeader title="بانک پرسش‌ها" description="مدیریت پرسش‌ها، دسته‌ها و نسخه‌ها" />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader title="پرسش جدید" />
          <CardBody>
            <QuestionForm categories={categories?.items ?? []} />
          </CardBody>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="پرسش‌ها" subtitle={`${questions?.items.length ?? 0} پرسش`} />
          {!questions || questions.items.length === 0 ? (
            <EmptyState title="پرسشی ثبت نشده است" />
          ) : (
            <Table head={['عنوان', 'دسته', 'نوع', 'وزن', 'نسخه', 'وضعیت', '']}>
              {questions.items.map((q) => (
                <tr key={q.id}>
                  <Td>{q.title}</Td>
                  <Td>{q.category?.name ?? '—'}</Td>
                  <Td>{ANSWER_LABELS[q.answerType] ?? q.answerType}</Td>
                  <Td className="tabular">{q.weight}</Td>
                  <Td><Badge tone="muted">v{q.currentVersion}</Badge></Td>
                  <Td><StatusBadge group="questionStatus" value={q.status} /></Td>
                  <Td>
                    {canEdit ? (
                      <Link href={`/admin/questions/${q.id}`} className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
                        ویرایش گزینه‌ها
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
