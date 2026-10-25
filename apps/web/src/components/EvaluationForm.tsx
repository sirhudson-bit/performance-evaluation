'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiClientError } from '@/lib/client';
import { Button, Card, CardHeader, CardBody, Alert, Field, Input, Textarea } from '@/components/ui';
import { faDigits } from '@/lib/format';

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

interface AnswerState {
  value: unknown;
  isNotApplicable: boolean;
}

export function EvaluationForm({ assignmentId, locked, sections }: { assignmentId: number; locked: boolean; sections: Section[] }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<number, AnswerState>>(() => {
    const initial: Record<number, AnswerState> = {};
    for (const section of sections) {
      for (const q of section.questions) {
        initial[q.formQuestionId] = { value: q.answer ?? null, isNotApplicable: q.isNotApplicable };
      }
    }
    return initial;
  });
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function set(id: number, patch: Partial<AnswerState>) {
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } as AnswerState }));
  }

  function payload() {
    return Object.entries(answers).map(([formQuestionId, a]) => ({
      formQuestionId: Number(formQuestionId),
      value: a.value,
      isNotApplicable: a.isNotApplicable,
    }));
  }

  async function saveDraft() {
    setBusy(true);
    setMessage(null);
    try {
      await apiClient('PUT', `/evaluations/${assignmentId}/responses`, { answers: payload() });
      setMessage({ type: 'success', text: 'پیش‌نویس ذخیره شد.' });
    } catch (err) {
      setMessage({ type: 'danger', text: err instanceof ApiClientError ? err.message : 'خطا در ذخیره.' });
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      await apiClient('PUT', `/evaluations/${assignmentId}/responses`, { answers: payload() });
      await apiClient('POST', `/evaluations/${assignmentId}/submit`);
      setMessage({ type: 'success', text: 'ارزیابی با موفقیت ارسال شد.' });
      router.refresh();
    } catch (err) {
      setMessage({ type: 'danger', text: err instanceof ApiClientError ? err.message : 'خطا در ارسال.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {message ? <Alert variant={message.type}>{message.text}</Alert> : null}

      {sections.map((section) => (
        <Card key={section.id}>
          <CardHeader title={section.title} subtitle={section.description ?? undefined} />
          <CardBody className="space-y-6">
            {section.questions.map((q) => {
              const state = answers[q.formQuestionId] ?? { value: q.answer ?? null, isNotApplicable: q.isNotApplicable };
              return (
                <div key={q.formQuestionId} className="border-b border-slate-100 pb-5 last:border-0 last:pb-0">
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    {q.title}
                    {q.required ? <span className="text-rose-600"> *</span> : null}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">{q.text}</p>
                  {q.guidance ? <p className="mt-1 text-xs text-slate-400">{q.guidance}</p> : null}

                  <div className="mt-3">
                    <AnswerInput
                      question={q}
                      state={state}
                      disabled={locked}
                      onChange={(patch) => set(q.formQuestionId, patch)}
                    />
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>
      ))}

      {!locked ? (
        <div className="flex items-center gap-3">
          <Button onClick={saveDraft} variant="secondary" disabled={busy}>ذخیره پیش‌نویس</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'در حال پردازش…' : 'ارسال نهایی ارزیابی'}</Button>
          <p className="text-xs text-slate-500">پس از ارسال نهایی، ویرایش فقط با بازگشایی مجاز امکان‌پذیر است.</p>
        </div>
      ) : null}
    </div>
  );
}

function AnswerInput({ question, state, disabled, onChange }: { question: Question; state: AnswerState; disabled: boolean; onChange: (p: Partial<AnswerState>) => void }) {
  const { answerType, options, scoring } = question;
  const na = state.isNotApplicable;

  if (answerType === 'rating_5' || answerType === 'single_choice') {
    return (
      <fieldset disabled={disabled || na}>
        <legend className="sr-only">{question.title}</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <label key={opt.value} className={`cursor-pointer rounded border px-3 py-1.5 text-sm ${state.value === opt.value ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-300 hover:bg-slate-50'}`}>
              <input type="radio" name={`q-${question.formQuestionId}`} className="sr-only" checked={state.value === opt.value} onChange={() => onChange({ value: opt.value })} />
              {opt.label}
            </label>
          ))}
        </div>
        <NaToggle state={state} disabled={disabled} onChange={onChange} />
      </fieldset>
    );
  }

  if (answerType === 'multi_choice') {
    const selected = Array.isArray(state.value) ? (state.value as string[]) : [];
    return (
      <fieldset disabled={disabled || na}>
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => {
            const on = selected.includes(opt.value);
            return (
              <label key={opt.value} className={`cursor-pointer rounded border px-3 py-1.5 text-sm ${on ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-300 hover:bg-slate-50'}`}>
                <input type="checkbox" className="sr-only" checked={on} onChange={() => onChange({ value: on ? selected.filter((v) => v !== opt.value) : [...selected, opt.value] })} />
                {opt.label}
              </label>
            );
          })}
        </div>
        <NaToggle state={state} disabled={disabled} onChange={onChange} />
      </fieldset>
    );
  }

  if (answerType === 'yes_no') {
    const opts = options.length > 0 ? options : [{ label: 'بله', value: 'yes', score: 100, isNotApplicable: false }, { label: 'خیر', value: 'no', score: 0, isNotApplicable: false }];
    return (
      <fieldset disabled={disabled || na}>
        <div className="flex gap-2">
          {opts.map((opt) => (
            <label key={opt.value} className={`cursor-pointer rounded border px-3 py-1.5 text-sm ${state.value === opt.value ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-300 hover:bg-slate-50'}`}>
              <input type="radio" name={`q-${question.formQuestionId}`} className="sr-only" checked={state.value === opt.value} onChange={() => onChange({ value: opt.value })} />
              {opt.label}
            </label>
          ))}
        </div>
        <NaToggle state={state} disabled={disabled} onChange={onChange} />
      </fieldset>
    );
  }

  if (answerType === 'percentage' || answerType === 'numeric_scale' || answerType === 'numeric') {
    const min = scoring.min ?? (answerType === 'percentage' ? 0 : undefined);
    const max = scoring.max ?? (answerType === 'percentage' ? 100 : undefined);
    return (
      <div className="max-w-xs">
        <Field label={answerType === 'percentage' ? 'درصد' : 'عدد'} htmlFor={`q-${question.formQuestionId}`} hint={min !== undefined && max !== undefined ? `بازه مجاز: ${faDigits(min)} تا ${faDigits(max)}` : undefined}>
          <Input
            id={`q-${question.formQuestionId}`}
            type="number"
            dir="ltr"
            min={min}
            max={max}
            disabled={disabled || na}
            value={state.value === null || state.value === undefined ? '' : String(state.value)}
            onChange={(e) => onChange({ value: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </Field>
        <NaToggle state={state} disabled={disabled} onChange={onChange} />
      </div>
    );
  }

  // Text
  return (
    <div>
      {answerType === 'long_text' ? (
        <Textarea rows={3} disabled={disabled || na} value={typeof state.value === 'string' ? state.value : ''} onChange={(e) => onChange({ value: e.target.value })} />
      ) : (
        <Input disabled={disabled || na} value={typeof state.value === 'string' ? state.value : ''} onChange={(e) => onChange({ value: e.target.value })} />
      )}
      <NaToggle state={state} disabled={disabled} onChange={onChange} />
    </div>
  );
}

function NaToggle({ state, disabled, onChange }: { state: AnswerState; disabled: boolean; onChange: (p: Partial<AnswerState>) => void }) {
  return (
    <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
      <input type="checkbox" disabled={disabled} checked={state.isNotApplicable} onChange={(e) => onChange({ isNotApplicable: e.target.checked, value: e.target.checked ? null : state.value })} />
      مصداق ندارد (N/A)
    </label>
  );
}
