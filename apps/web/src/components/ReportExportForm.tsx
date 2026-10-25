'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiClientError } from '@/lib/client';
import { Button, Field, Select, Alert } from '@/components/ui';

const REPORTS = [
  { value: 'executive_summary', label: 'خلاصه اجرایی' },
  { value: 'employee_results', label: 'نتایج کارکنان' },
  { value: 'scores_breakdown', label: 'تفکیک امتیازها' },
  { value: 'completion_status', label: 'وضعیت تکمیل' },
  { value: 'appeals', label: 'اعتراض‌ها' },
  { value: 'compensation', label: 'جبران خدمات' },
];

/** Super-admin only: raw answers grouped by employee. */
const RESPONSES_REPORT = { value: 'responses_by_user', label: 'پاسخ‌های کاربران (به تفکیک کاربر)' };

export function ReportExportForm({ cycles, canExportResponses = false }: { cycles: { id: number; name: string }[]; canExportResponses?: boolean }) {
  const reports = canExportResponses ? [...REPORTS, RESPONSES_REPORT] : REPORTS;
  const router = useRouter();
  const [report, setReport] = useState('employee_results');
  const [format, setFormat] = useState('xlsx');
  const [cycleId, setCycleId] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await apiClient('POST', '/reports/exports', {
        report,
        format,
        filters: cycleId ? { cycleId: Number(cycleId) } : {},
      });
      setMessage({ type: 'success', text: 'خروجی در صف ساخت قرار گرفت. پس از آماده‌شدن، لینک دانلود نمایش داده می‌شود.' });
      router.refresh();
    } catch (err) {
      setMessage({ type: 'danger', text: err instanceof ApiClientError ? err.message : 'خطا در درخواست خروجی.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {message ? <Alert variant={message.type}>{message.text}</Alert> : null}
      <Field label="نوع گزارش" htmlFor="r-report" required>
        <Select id="r-report" value={report} onChange={(e) => setReport(e.target.value)}>
          {reports.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </Select>
      </Field>
      <Field label="قالب" htmlFor="r-format" required>
        <Select id="r-format" value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="xlsx">Excel (xlsx)</option>
          <option value="csv">CSV</option>
        </Select>
      </Field>
      <Field label="دوره (اختیاری)" htmlFor="r-cycle">
        <Select id="r-cycle" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
          <option value="">همه دوره‌ها</option>
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </Field>
      <Button type="submit" disabled={busy}>{busy ? 'در حال ارسال…' : 'درخواست خروجی'}</Button>
    </form>
  );
}
