'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, ClipboardList, Users, BarChart3, Sparkles, UserCog, LogOut, Menu,
  ShieldCheck, GitBranch, ListChecks, FileSpreadsheet, Server, Coins, ScrollText, Building2, ListTree,
  Brain, MessagesSquare, Wand2, Target, FileSignature, Gauge, HelpCircle, ChevronDown, Settings, LifeBuoy,
} from 'lucide-react';
import { cn } from '@pe/ui';
import { apiClient } from '@/lib/client';
import type { SessionUser } from '@/lib/api';
import { ThemeToggle } from '@/components/ThemeToggle';
import { FloatingTips } from '@/components/FloatingTips';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavItem { href: string; label: string; icon: LucideIcon; permission?: string }
interface NavGroup { title: string; items: NavItem[] }

/** Grouped navigation: daily work, evaluation administration, system administration. */
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

function initials(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]).join('') || '؟';
}

function SidebarContent({
  user,
  groups,
  pathname,
  onNavigate,
  onLogout,
  onClose,
}: {
  user: SessionUser;
  groups: NavGroup[];
  pathname: string;
  onNavigate: () => void;
  onLogout: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-4 lg:hidden">
        <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">منوی اصلی</span>
        {onClose ? (
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="بستن منو"
          >
            <Menu aria-hidden className="h-4 w-4 rotate-90" />
          </button>
        ) : null}
      </div>

      <nav aria-label="ناوبری اصلی" className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 pt-2">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="px-3 pb-1.5 text-[10px] font-bold tracking-wide text-slate-400">{group.title}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      data-tour={`nav-${item.href}`}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-150',
                        active
                          ? 'bg-brand-50 text-brand-800 shadow-[inset_0_0_0_1px_rgba(37,99,235,0.08)] dark:bg-brand-950/50 dark:text-brand-200'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors',
                          active
                            ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/20'
                            : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-brand-600 dark:bg-slate-800 dark:text-slate-400',
                        )}
                      >
                        <Icon aria-hidden className="h-3.5 w-3.5" />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-3 dark:border-slate-800">
        <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">{user.name}</p>
            <p className="truncate text-[10px] text-slate-400">{user.roles.map((r) => r.name).join('، ') || 'کاربر'}</p>
          </div>
          <Link href="/profile" onClick={onNavigate} className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-brand-600 dark:hover:bg-slate-700" aria-label="پروفایل">
            <Settings aria-hidden className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={onLogout}
            className="rounded-lg p-1.5 text-rose-500 transition hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
            aria-label="خروج"
          >
            <LogOut aria-hidden className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-slate-400">سامانه ارزیابی عملکرد · نسخه ۰.۱</p>
      </div>
    </div>
  );
}

export function Shell({ user, orgDisplayName, children }: { user: SessionUser; orgDisplayName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

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
    <div className="min-h-screen overflow-x-clip bg-canvas dark:bg-slate-950">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/85 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="باز کردن منو"
            aria-expanded={mobileOpen}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 lg:hidden"
          >
            <Menu aria-hidden className="h-4 w-4" />
          </button>
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-sky-400 text-white shadow-lg shadow-brand-500/20">
              <Gauge aria-hidden className="h-5 w-5" />
            </span>
            <span className="hidden min-w-0 flex-col leading-tight sm:flex">
              <span className="truncate text-[13px] font-extrabold text-slate-900 dark:text-slate-100">سامانه ارزیابی عملکرد</span>
              <span className="truncate text-[10px] text-slate-500 dark:text-slate-400">{orgDisplayName}</span>
            </span>
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Link
            href="/help"
            data-tour="help"
            className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 sm:flex"
          >
            <HelpCircle aria-hidden className="h-4 w-4" />
            راهنما
          </Link>
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-xl p-1.5 pe-2 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800" aria-label="منوی حساب کاربری">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white dark:bg-slate-100 dark:text-slate-900">
                  {initials(user.name)}
                </span>
                <span className="hidden max-w-28 flex-col items-start leading-tight md:flex">
                  <span className="truncate text-[11px] font-bold text-slate-800 dark:text-slate-100">{user.name}</span>
                  <span className="truncate text-[9px] text-slate-400">{user.roles[0]?.name ?? 'کاربر'}</span>
                </span>
                <ChevronDown aria-hidden className="hidden h-3.5 w-3.5 text-slate-400 md:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="w-full"><UserCog aria-hidden className="h-4 w-4" />پروفایل من</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/help" className="w-full"><LifeBuoy aria-hidden className="h-4 w-4" />راهنما و پشتیبانی</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => void logout()}>
                <LogOut aria-hidden className="h-4 w-4" />خروج از حساب
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[17.5rem] shrink-0 border-l border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 lg:block">
          <SidebarContent
            user={user}
            groups={groups}
            pathname={pathname}
            onNavigate={() => undefined}
            onLogout={() => void logout()}
          />
        </aside>

        <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogContent
            hideClose
            className="left-auto right-0 top-0 h-[100dvh] max-h-none w-[min(20rem,88vw)] max-w-none translate-x-0 translate-y-0 rounded-none border-y-0 border-l-0 p-0"
            aria-label="منوی اصلی"
          >
            <DialogTitle className="sr-only">منوی اصلی</DialogTitle>
            <SidebarContent
              user={user}
              groups={groups}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
              onLogout={() => void logout()}
              onClose={() => setMobileOpen(false)}
            />
          </DialogContent>
        </Dialog>

        <main id="main" className="min-w-0 flex-1 p-4 lg:p-8">
          <div key={pathname} className="mx-auto w-full max-w-[1500px] animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      <FloatingTips />
    </div>
  );
}
