'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, ClipboardList, Users, BarChart3, Sparkles, UserCog, LogOut, Menu, X,
  ShieldCheck, GitBranch, ListChecks, FileSpreadsheet, Server, Coins, ScrollText, Building2, ListTree,
  Brain, MessagesSquare, Wand2, Target, FileSignature,
} from 'lucide-react';
import { cn } from '@pe/ui';
import { apiClient } from '@/lib/client';
import type { SessionUser } from '@/lib/api';
import { ThemeToggle } from '@/components/ThemeToggle';
import { FloatingTips } from '@/components/FloatingTips';
import { OnboardingTour } from '@/components/tours';

interface NavItem { href: string; label: string; icon: LucideIcon; permission?: string }
interface NavGroup { title: string; items: NavItem[] }

/** Consolidated menu: related sections are folded into three clear groups. */
const GROUPS: NavGroup[] = [
  {
    title: 'کارهای من',
    items: [
      { href: '/dashboard', label: 'داشبورد', icon: LayoutDashboard, permission: 'dashboard.view' },
      { href: '/my-performance', label: 'عملکرد من', icon: Target },
      { href: '/evaluations', label: 'ارزیابی‌های من', icon: ClipboardList, permission: 'evaluations.view_own' },
      { href: '/team', label: 'کارکنان تحت مدیریت', icon: Users, permission: 'employees.view' },
      { href: '/results', label: 'نتایج', icon: BarChart3, permission: 'reports.view' },
      { href: '/appeals', label: 'اعتراض‌ها', icon: ScrollText, permission: 'appeals.view' },
      { href: '/agreements', label: 'توافق‌نامه‌های عملکرد', icon: FileSignature, permission: 'agreements.view' },
      { href: '/improvement-plans', label: 'برنامه‌های بهبود', icon: ListChecks, permission: 'improvement_plans.view' },
      { href: '/compensation', label: 'جبران خدمات', icon: Coins, permission: 'compensation.view' },
      { href: '/reports', label: 'گزارش‌ها و خروجی', icon: FileSpreadsheet, permission: 'reports.view' },
      { href: '/tickets', label: 'پیام‌ها و تیکت‌ها', icon: MessagesSquare, permission: 'tickets.view' },
      { href: '/assistant', label: 'دستیار هوشمند', icon: Sparkles, permission: 'ai.use' },
      { href: '/profile', label: 'پروفایل من', icon: UserCog },
    ],
  },
  {
    title: 'مدیریت ارزیابی',
    items: [
      { href: '/admin/wizard', label: 'ویزارد ایجاد', icon: Wand2, permission: 'forms.create' },
      { href: '/admin/processes', label: 'فرایندهای عملکرد', icon: Target, permission: 'processes.view' },
      { href: '/admin/organization', label: 'ساختار سازمانی', icon: Building2, permission: 'organization.view' },
      { href: '/admin/questions', label: 'بانک پرسش‌ها', icon: ListTree, permission: 'questions.view' },
      { href: '/admin/forms', label: 'فرم‌ها و نسخه‌ها', icon: ClipboardList, permission: 'forms.view' },
      { href: '/admin/cycles', label: 'دوره‌های ارزیابی', icon: GitBranch, permission: 'cycles.view' },
    ],
  },
  {
    title: 'مدیریت سامانه',
    items: [
      { href: '/admin/users', label: 'کاربران', icon: Users, permission: 'users.view' },
      { href: '/admin/roles', label: 'نقش‌ها و دسترسی‌ها', icon: ShieldCheck, permission: 'roles.view' },
      { href: '/admin/tickets', label: 'مدیریت تیکت‌ها', icon: MessagesSquare, permission: 'tickets.manage' },
      { href: '/admin/ai', label: 'هوش مصنوعی', icon: Brain, permission: 'ai.manage' },
      { href: '/admin/compliance', label: 'انطباق و حریم خصوصی', icon: ShieldCheck, permission: 'compliance.manage' },
      { href: '/admin/settings', label: 'تنظیمات و PWA', icon: Server, permission: 'settings.view' },
      { href: '/admin/sms', label: 'پیامک و اطلاع‌رسانی', icon: MessagesSquare, permission: 'settings.view' },
      { href: '/admin/audit', label: 'گزارش رخدادها', icon: ScrollText, permission: 'audit.view' },
    ],
  },
];

export function Shell({ user, orgDisplayName, children }: { user: SessionUser; orgDisplayName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const allowed = (item: NavItem) => !item.permission || user.permissions.includes(item.permission);
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter(allowed) })).filter((g) => g.items.length > 0);

  async function logout() {
    try {
      await apiClient('POST', '/auth/logout');
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen overflow-x-clip">
      {/* Top bar: full width, above the sidebar + content row. */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-surface px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex min-w-0 items-center gap-2">
          <button onClick={() => setOpen((v) => !v)} aria-label={open ? 'بستن منو' : 'باز کردن منو'} aria-expanded={open} className="rounded p-2 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden">
            {open ? <X aria-hidden className="h-5 w-5" /> : <Menu aria-hidden className="h-5 w-5" />}
          </button>
          <Link href="/dashboard" className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">سامانه ارزیابی عملکرد</span>
            <span className="truncate text-xs text-slate-500 dark:text-slate-400">{orgDisplayName}</span>
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link href="/help" data-tour="help" className="rounded px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            راهنما
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="lg:flex">
        <aside
          className={cn(
            // Below lg the sidebar is a drawer that is *removed from layout* when
            // closed. Keeping it mounted but translated off-screen widened the
            // mobile layout viewport (every page scrolled sideways) and inflated
            // fixed overlays such as the guided tour to that wider width.
            'fixed inset-y-0 right-0 z-40 w-72 overflow-y-auto border-l border-slate-200 bg-surface p-4 dark:border-slate-800 dark:bg-slate-900 lg:static lg:z-0 lg:block lg:h-[calc(100vh-3.75rem)]',
            open ? 'block' : 'hidden',
          )}
        >
          <nav aria-label="ناوبری اصلی" data-tour="sidebar" className="space-y-4">
            {groups.map((group) => (
              <div key={group.title}>
                <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{group.title}</p>
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          data-tour={`nav-${item.href}`}
                          onClick={() => setOpen(false)}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors duration-150',
                            active
                              ? 'bg-brand-50 font-medium text-brand-800 dark:bg-brand-950/50 dark:text-brand-200'
                              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                          )}
                        >
                          <Icon aria-hidden className="h-4 w-4" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
          <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
            <p className="px-3 text-sm font-medium text-slate-700 dark:text-slate-200">{user.name}</p>
            <p className="px-3 text-xs text-slate-400">{user.roles.map((r) => r.name).join('، ')}</p>
            {user.department ? <p className="px-3 text-xs text-slate-400">واحد: {user.department.name}</p> : null}
            <button onClick={logout} className="mt-2 flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-rose-600 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/40">
              <LogOut aria-hidden className="h-4 w-4" />
              خروج
            </button>
          </div>
        </aside>

        {open ? <div className="fixed inset-0 z-30 bg-slate-900/20 lg:hidden" onClick={() => setOpen(false)} aria-hidden /> : null}

        <main id="main" className="min-w-0 flex-1 p-4 lg:p-8">
          <div key={pathname} className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      <FloatingTips />
      <OnboardingTour />
    </div>
  );
}
