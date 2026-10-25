import { redirect } from 'next/navigation';
import { apiData, getSession } from '@/lib/api';
import { Shell } from '@/components/Shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, config] = await Promise.all([
    getSession(),
    apiData<{ organizationDisplayName?: string }>('/public/config'),
  ]);
  if (!user) redirect('/login');
  const orgDisplayName = config?.organizationDisplayName ?? user.organization?.name ?? '';
  return (
    <Shell user={user} orgDisplayName={orgDisplayName}>
      {children}
    </Shell>
  );
}
