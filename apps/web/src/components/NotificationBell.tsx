'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, ClipboardCheck, Info, MessageSquare, Trophy } from 'lucide-react';
import { apiClient } from '@/lib/client';
import { faDigits } from '@/lib/format';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

const ICONS: Record<string, typeof Bell> = {
  evaluation_assigned: ClipboardCheck,
  result_published: Trophy,
  ticket_reply: MessageSquare,
  system: Info,
};

function relativeTime(iso: string): string {
  const date = new Date(iso);
  const seconds = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'همین حالا';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${faDigits(minutes)} دقیقه پیش`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${faDigits(hours)} ساعت پیش`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${faDigits(days)} روز پیش`;
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(date);
}

/**
 * Notification centre in the shell header.
 *
 * Uses a Radix Popover for the panel, fetches the signed-in user's inbox from
 * `/notifications`, marks items read optimistically and reloads the count when
 * the panel opens. New notifications are created by the API when an evaluation
 * is assigned and when results are published.
 */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiClient<{ items: NotificationItem[]; unread: number }>('GET', '/notifications?perPage=10');
      setItems(data.items);
      setUnread(data.unread);
      setLoaded(true);
    } catch {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function markRead(item: NotificationItem) {
    if (!item.readAt) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
      setUnread((count) => Math.max(0, count - 1));
      try {
        await apiClient('POST', `/notifications/${item.id}/read`);
      } catch {
        /* optimistic update; next poll repairs the state */
      }
    }

    const assignmentId = typeof item.data?.assignmentId === 'number' ? item.data.assignmentId : null;
    if (item.type === 'evaluation_assigned' && assignmentId) router.push(`/evaluations/${assignmentId}`);
    else if (item.type === 'result_published') router.push('/results');
    else if (item.type === 'ticket_reply') router.push('/tickets');
    setOpen(false);
  }

  async function markAllRead() {
    setBusy(true);
    try {
      await apiClient('POST', '/notifications/read-all');
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      setUnread(0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `${faDigits(unread)} اعلان خوانده‌نشده` : 'اعلان‌ها'}
          className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Bell aria-hidden className="h-[18px] w-[18px]" />
          {unread > 0 ? (
            <span className="absolute -left-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
              {faDigits(unread > 99 ? '99+' : unread)}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(23rem,calc(100vw-2rem))]">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div>
            <p className="text-sm font-extrabold text-slate-900 dark:text-slate-50">اعلان‌ها</p>
            <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
              {unread > 0 ? `${faDigits(unread)} مورد خوانده‌نشده` : 'همه اعلان‌ها خوانده شده‌اند'}
            </p>
          </div>
          {unread > 0 ? (
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={busy}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-brand-700 transition hover:bg-brand-50 disabled:opacity-50 dark:text-brand-300 dark:hover:bg-brand-950/40"
            >
              <CheckCheck aria-hidden className="h-3.5 w-3.5" />
              خواندن همه
            </button>
          ) : null}
        </div>

        <div className="max-h-[21rem] overflow-y-auto">
          {!loaded ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                <Bell aria-hidden className="h-5 w-5" />
              </span>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">اعلانی ندارید</p>
              <p className="text-[10px] leading-5 text-slate-500 dark:text-slate-400">وقتی ارزیابی جدیدی به شما ارجاع شود یا نتیجه‌ای منتشر شود، اینجا نمایش داده می‌شود.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((item) => {
                const Icon = ICONS[item.type] ?? Bell;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void markRead(item)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-right transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${item.readAt ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : 'bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300'}`}>
                        <Icon aria-hidden className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className={`text-[11px] leading-5 ${item.readAt ? 'font-medium text-slate-600 dark:text-slate-300' : 'font-bold text-slate-900 dark:text-slate-100'}`}>
                            {item.title}
                          </span>
                          {!item.readAt ? <span aria-label="خوانده‌نشده" className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" /> : null}
                        </span>
                        {item.body ? <span className="mt-0.5 block line-clamp-2 text-[10px] leading-5 text-slate-500 dark:text-slate-400">{item.body}</span> : null}
                        <span className="mt-1 block text-[9px] text-slate-400">{relativeTime(item.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
