'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { apiClient, ApiClientError } from '@/lib/client';
import { Button, Field, Input, Textarea, Select, Alert, Card, CardBody } from '@/components/ui';
import { cn } from '@pe/ui';

interface Question { id: number; title: string; answerType: string; category: { id: number; name: string } | null }
interface SectionDraft { title: string; weight: string; questionIds: number[] }

function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-2 text-xs">
      {steps.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full border',
              i < current ? 'border-brand-600 bg-brand-600 text-white' : i === current ? 'border-brand-600 text-brand-700 dark:text-brand-300' : 'border-slate-300 text-slate-400 dark:border-slate-700',
            )}
          >
            {i < current ? <Check aria-hidden className="h-4 w-4" /> : i + 1}
          </span>
          <span className={cn(i === current ? 'font-medium text-slate-800 dark:text-slate-100' : 'text-slate-500')}>{label}</span>
          {i < steps.length - 1 ? <ChevronLeft aria-hidden className="h-4 w-4 text-slate-300" /> : null}
        </li>
      ))}
    </ol>
  );
}

export function FormWizard({ questions, categories }: { questions: Question[]; categories: { id: number; name: string }[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const steps = ['اطلاعات فرم', 'بخش‌ها', 'پرسش‌ها', 'بازبینی و انتشار'];

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sections, setSections] = useState<SectionDraft[]>([{ title: 'شایستگی‌های عمومی', weight: '60', questionIds: [] }]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // ids minted as the wizard progresses
  const [versionId, setVersionId] = useState<number | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const visibleQuestions = categoryFilter ? questions.filter((q) => q.category?.id === Number(categoryFilter)) : questions;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'خطا در انجام عملیات.');
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (step === 0) {
      if (name.trim().length < 2) return setError('نام فرم را وارد کنید.');
      await run(async () => {
        const form = await apiClient<{ id: number }>('POST', '/forms', { name, description: description || undefined });
        const version = await apiClient<{ id: number }>('POST', `/forms/${form.id}/versions`);
        setVersionId(version.id);
        setStep(1);
      }).catch(() => undefined);
      return;
    }
    if (step === 1) {
      if (sections.some((s) => s.title.trim().length < 2)) return setError('عنوان همه بخش‌ها الزامی است.');
      await run(async () => {
        if (!versionId) throw new ApiClientError(500, 'نسخه فرم ساخته نشده است.');
        // Sections are created once (step may be revisited; only add new ones by index).
        const existing = new Set(await apiClient<{ version: { sections: { id: number; title: string }[] } }>('GET', `/forms/versions/${versionId}`).then((r) => r.version.sections.map((s) => s.title)));
        let order = existing.size;
        for (const s of sections) {
          if (existing.has(s.title)) continue;
          await apiClient('POST', `/forms/versions/${versionId}/sections`, { title: s.title, weight: Number(s.weight) || 0, sortOrder: order++ });
        }
        setStep(2);
      }).catch(() => undefined);
      return;
    }
    if (step === 2) {
      const chosen = sections.reduce((n, s) => n + s.questionIds.length, 0);
      if (chosen === 0) return setError('حداقل یک پرسش انتخاب کنید.');
      await run(async () => {
        if (!versionId) throw new ApiClientError(500, 'نسخه فرم ساخته نشده است.');
        const full = await apiClient<{ version: { sections: { id: number; title: string }[]; questions: { questionVersion: { questionId: number } }[] } }>('GET', `/forms/versions/${versionId}`);
        const sectionIdByTitle = new Map(full.version.sections.map((s) => [s.title, s.id]));
        const already = new Set(full.version.questions.map((q) => q.questionVersion.questionId));
        for (const s of sections) {
          const sectionId = sectionIdByTitle.get(s.title);
          if (!sectionId) continue;
          let order = 0;
          for (const qid of s.questionIds) {
            if (already.has(qid)) continue;
            await apiClient('POST', `/forms/versions/${versionId}/questions`, { sectionId, questionId: qid, weight: 1, required: true, sortOrder: order++ });
          }
        }
        setStep(3);
      }).catch(() => undefined);
      return;
    }
    if (step === 3) {
      await run(async () => {
        if (!versionId) throw new ApiClientError(500, 'نسخه فرم ساخته نشده است.');
        const res = await apiClient<{ warnings: string[] }>('POST', `/forms/versions/${versionId}/publish`);
        setWarnings(res.warnings ?? []);
        setDone(true);
        router.refresh();
      }).catch(() => undefined);
    }
  }

  if (done) {
    return (
      <Card>
        <CardBody className="space-y-3 text-center">
          <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">فرم با موفقیت منتشر شد</p>
          {warnings.length > 0 ? <Alert variant="warning">{warnings.join(' ')}</Alert> : null}
          <div className="flex justify-center gap-2">
            <Button onClick={() => router.push('/admin/cycles')}>ساخت دوره ارزیابی</Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>ساخت فرم جدید</Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div>
      <Stepper steps={steps} current={step} />
      {error ? <div className="mb-4"><Alert variant="danger">{error}</Alert></div> : null}

      {step === 0 ? (
        <div className="space-y-4">
          <Field label="نام فرم" htmlFor="fw-name" required><Input id="fw-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="توضیح" htmlFor="fw-desc"><Textarea id="fw-desc" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <Alert variant="info">بخش‌ها گروه‌بندی پرسش‌ها هستند و هر بخش یک وزن دارد. مجموع وزن‌ها ۱۰۰ توصیه می‌شود (در غیر این صورت به‌صورت خودکار نرمال می‌شود).</Alert>
          {sections.map((s, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2 rounded border border-slate-200 p-3 dark:border-slate-700">
              <Field label={`عنوان بخش ${i + 1}`} htmlFor={`sec-${i}`}><Input id={`sec-${i}`} value={s.title} onChange={(e) => setSections((prev) => prev.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} /></Field>
              <Field label="وزن" htmlFor={`secw-${i}`}><Input id={`secw-${i}`} dir="ltr" type="number" className="w-24" value={s.weight} onChange={(e) => setSections((prev) => prev.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))} /></Field>
              {sections.length > 1 ? (
                <Button type="button" variant="ghost" onClick={() => setSections((prev) => prev.filter((_, j) => j !== i))}><Trash2 aria-hidden className="h-4 w-4" /> حذف</Button>
              ) : null}
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={() => setSections((prev) => [...prev, { title: '', weight: '40', questionIds: [] }])}><Plus aria-hidden className="h-4 w-4" /> افزودن بخش</Button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-5">
          <Field label="فیلتر دسته" htmlFor="fw-cat">
            <Select id="fw-cat" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">همه دسته‌ها</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          {sections.map((s, i) => (
            <div key={i} className="rounded border border-slate-200 p-3 dark:border-slate-700">
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">{s.title || `بخش ${i + 1}`} — انتخاب پرسش</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {visibleQuestions.map((q) => (
                  <label key={q.id} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <input type="checkbox" className="mt-0.5" checked={s.questionIds.includes(q.id)} onChange={(e) => setSections((prev) => prev.map((x, j) => (j === i ? { ...x, questionIds: e.target.checked ? [...x.questionIds, q.id] : x.questionIds.filter((id) => id !== q.id) } : x)))} />
                    <span>{q.title}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <p>فرم «{name}» با {sections.length} بخش و {sections.reduce((n, s) => n + s.questionIds.length, 0)} پرسش آماده انتشار است.</p>
          <p>با انتشار، این نسخه تثبیت و غیرقابل‌ویرایش می‌شود؛ برای تغییر بعدی، نسخه جدید بسازید.</p>
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between">
        <Button variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={busy || step === 0}>
          <ChevronRight aria-hidden className="h-4 w-4" /> مرحله قبل
        </Button>
        <Button onClick={next} disabled={busy}>
          {busy ? 'در حال انجام…' : step === 3 ? 'انتشار فرم' : 'مرحله بعد'} <ChevronLeft aria-hidden className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
