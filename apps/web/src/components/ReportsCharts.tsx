'use client';

import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Card, CardHeader, CardBody, EmptyState } from '@/components/ui';
import { faDigits, formatScore } from '@/lib/format';

export interface GroupAverage { name: string; average: number; count: number }
export interface Analytics {
  cycleId: number | null;
  total: number;
  scored: number;
  average: number | null;
  distribution: { range: string; count: number }[];
  statuses: { status: string; count: number }[];
  byUnit?: GroupAverage[];
  byPosition?: GroupAverage[];
}

const COLORS = ['#1e3a8a', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#0ea5e9'];
const STATUS_LABELS: Record<string, string> = {
  assigned: 'ارجاع‌شده', in_progress: 'در حال تکمیل', submitted: 'ارسال‌شده',
  under_review: 'در حال بررسی', approved: 'تأییدشده', published: 'منتشرشده',
  returned_for_revision: 'بازگشت', draft: 'پیش‌نویس', cancelled: 'لغو‌شده',
};

const AXIS = '#94a3b8';
const TOOLTIP_STYLE = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 12,
  color: '#e2e8f0',
  fontSize: 12,
} as const;

function GroupChart({ title, data, color }: { title: string; data: GroupAverage[]; color: string }) {
  return (
    <Card>
      <CardHeader title={title} subtitle="میانگین امتیاز برای کارکنان در محدوده دسترسی" />
      <CardBody>
        {data.length === 0 ? (
          <EmptyState title="داده‌ای برای نمایش نیست" />
        ) : (
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid stroke={AXIS} strokeOpacity={0.2} horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: AXIS, fontSize: 12 }} tickFormatter={(v: number) => faDigits(v)} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fill: AXIS, fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#e2e8f0' }} formatter={(v: number) => [formatScore(v), 'میانگین']} />
                <Bar dataKey="average" fill={color} radius={[0, 8, 8, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export function ReportsCharts({ data }: { data: Analytics }) {
  if (data.scored === 0 && data.statuses.length === 0) {
    return (
      <Card>
        <CardHeader title="نمودارها" />
        <EmptyState title="برای این بازه داده‌ای برای نمایش وجود ندارد" />
      </Card>
    );
  }

  const statusData = data.statuses.map((s) => ({ name: STATUS_LABELS[s.status] ?? s.status, count: s.count }));
  const totalAssignments = statusData.reduce((a, b) => a + b.count, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="توزیع امتیاز نهایی" subtitle={`میانگین: ${data.average !== null ? formatScore(data.average) : '—'} — ${faDigits(data.scored)} نتیجه`} />
        <CardBody>
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.distribution} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid stroke={AXIS} strokeOpacity={0.2} vertical={false} />
                <XAxis dataKey="range" tick={{ fill: AXIS, fontSize: 12 }} axisLine={{ stroke: AXIS, strokeOpacity: 0.4 }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 12 }} axisLine={{ stroke: AXIS, strokeOpacity: 0.4 }} tickLine={false} tickFormatter={(v: number) => faDigits(v)} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#e2e8f0' }} formatter={(v: number) => [faDigits(v), 'تعداد']} />
                <Bar dataKey="count" fill="#2563eb" radius={[8, 8, 0, 0]} maxBarSize={64} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="وضعیت ارزیابی‌ها" subtitle={`${faDigits(totalAssignments)} ارجاع`} />
        <CardBody>
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="count" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={2} stroke="none">
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#e2e8f0' }} formatter={(v: number) => [faDigits(v), 'تعداد']} />
                <Legend wrapperStyle={{ fontSize: 12, color: AXIS, paddingTop: 8 }} formatter={(value: string) => <span style={{ color: AXIS }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      <GroupChart title="میانگین امتیاز به تفکیک واحد سازمانی" data={data.byUnit ?? []} color="#0ea5e9" />
      <GroupChart title="میانگین امتیاز به تفکیک سمت" data={data.byPosition ?? []} color="#1e3a8a" />
    </div>
  );
}
