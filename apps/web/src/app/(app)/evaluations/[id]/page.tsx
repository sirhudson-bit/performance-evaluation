import { notFound } from 'next/navigation';
import { apiData } from '@/lib/api';
import { PageHeader, StatusBadge, Alert } from '@/components/ui';
import { formatJalali } from '@/lib/format';
import { EvaluationForm } from '@/components/EvaluationForm';
import { RoleLabel } from '@/components/RoleLabel';

interface Option { label: string; value: string; score: number | null; isNotApplicable: boolean }
interface Question {
  formQuestionId: number;
  title: string;
  text: string;
  guidance?: string | null;
  answerType: string;
  scoring: { min?: number; max?: number; unit?: string };
  options: Option[];
  required: boolean;
  answer: unknown;
  isNotApplicable: boolean;
}
interface Section { id: number; title: string; description: string | null; weight: number; questions: Question[] }
interface Detail {
  assignment: { id: number; status: string; evaluatorRole: string; dueDate: string | null; submittedAt: string | null };
  cycle: { id: number; name: string; confidentialityMode: string; endDate: string };
  employee: { firstName: string; lastName: string; employeeNo: string };
  locked: boolean;
  sections: Section[];
}

export default async function EvaluationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await apiData<Detail>(`/evaluations/${id}`);
  if (!data) notFound();

  return (
    <>
      <PageHeader
        title={`ارزیابی ${data.employee.firstName} ${data.employee.lastName}`}
        description={`${data.cycle.name} — نقش شما: `}
        actions={<StatusBadge group="assignmentStatus" value={data.assignment.status} />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <span>نقش شما: <RoleLabel role={data.assignment.evaluatorRole} /></span>
        <span>•</span>
        <span>مهلت: {formatJalali(data.assignment.dueDate)}</span>
      </div>

      {data.locked ? (
        <Alert variant="info">این ارزیابی ارسال شده و در حالت مشاهده است. تغییر آن نیازمند بازگشایی مجاز توسط منابع انسانی است.</Alert>
      ) : null}

      <EvaluationForm
        assignmentId={data.assignment.id}
        locked={data.locked}
        sections={data.sections}
      />
    </>
  );
}
