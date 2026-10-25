import { apiData, getSession, hasPermission } from '@/lib/api';
import { PageHeader, Card, CardHeader, CardBody, Alert } from '@/components/ui';
import { FormWizard } from '@/components/FormWizard';
import { CycleWizard } from '@/components/CycleWizard';
import { WizardTabs } from '@/components/WizardTabs';

interface Question { id: number; title: string; answerType: string; category: { id: number; name: string } | null }
interface FormRow { id: number; name: string; versions: { id: number; version: number; status: string }[] }
interface Employee { id: number; firstName: string; lastName: string; employeeNo: string }

export default async function WizardPage() {
  const user = await getSession();
  const canForms = hasPermission(user, 'forms.create');
  const canCycles = hasPermission(user, 'cycles.create');

  const [questions, categories, forms, employees] = await Promise.all([
    canForms ? apiData<{ items: Question[] }>('/questions') : Promise.resolve(null),
    canForms ? apiData<{ items: { id: number; name: string }[] }>('/questions/categories') : Promise.resolve(null),
    apiData<{ items: FormRow[] }>('/forms'),
    canCycles ? apiData<{ items: Employee[] }>('/employees?perPage=100') : Promise.resolve(null),
  ]);

  const versions = (forms?.items ?? [])
    .flatMap((f) => f.versions.filter((v) => v.status === 'published').map((v) => ({ id: v.id, label: `${f.name} — v${v.version}` })));
  const employeeOptions = (employees?.items ?? []).map((e) => ({ id: e.id, label: `${e.firstName} ${e.lastName} (${e.employeeNo})` }));

  if (!canForms && !canCycles) {
    return (
      <>
        <PageHeader title="ویزارد ایجاد" />
        <Alert variant="warning">شما به این بخش دسترسی ندارید.</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader title="ویزارد ایجاد" description="ساخت گام‌به‌گام فرم ارزیابی و دوره ارزیابی، بدون نیاز به تنظیمات پراکنده" />
      <Card>
        <CardHeader title="ایجاد گام‌به‌گام" subtitle="در چند مرحله ساده، فرم و دوره را بسازید و منتشر کنید" />
        <CardBody>
          <WizardTabs
            form={
              canForms ? (
                <FormWizard questions={questions?.items ?? []} categories={categories?.items ?? []} />
              ) : (
                <Alert variant="warning">برای ساخت فرم به دسترسی «ایجاد فرم» نیاز دارید.</Alert>
              )
            }
            cycle={
              canCycles ? (
                <CycleWizard versions={versions} employees={employeeOptions} />
              ) : (
                <Alert variant="warning">برای ساخت دوره به دسترسی «ایجاد دوره» نیاز دارید.</Alert>
              )
            }
          />
        </CardBody>
      </Card>
    </>
  );
}
