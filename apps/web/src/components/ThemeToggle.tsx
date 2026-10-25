'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { apiClient } from '@/lib/client';

/** Toggles light/dark, persists to localStorage and (best-effort) the profile. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('pe_theme', next ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
    setDark(next);
    // Persist preference server-side; failure is non-fatal (localStorage wins).
    apiClient('PATCH', '/auth/profile', { themePreference: next ? 'dark' : 'light' }).catch(() => undefined);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      data-tour="theme"
      aria-label={dark ? 'تغییر به حالت روشن' : 'تغییر به حالت تیره'}
      title={dark ? 'حالت روشن' : 'حالت تیره'}
      className="rounded p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {dark ? <Sun aria-hidden className="h-5 w-5" /> : <Moon aria-hidden className="h-5 w-5" />}
    </button>
  );
}
