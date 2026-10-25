'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui';

/** App-level error boundary: shows a friendly message and surfaces the cause. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keep the real error visible in the browser console for debugging.
    console.error('[app error]', error);
  }, [error]);

  return (
    <div className="rounded border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900 dark:bg-rose-950/40">
      <h2 className="text-base font-semibold text-rose-700 dark:text-rose-300">خطایی رخ داد</h2>
      <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">لطفاً دوباره تلاش کنید. اگر خطا ادامه داشت، به مدیر سامانه اطلاع دهید.</p>
      <p className="mt-3 break-words text-xs text-slate-500 dark:text-slate-400" dir="ltr">
        {error.message}
        {error.digest ? ` (digest: ${error.digest})` : ''}
      </p>
      <div className="mt-4">
        <Button onClick={reset}>تلاش مجدد</Button>
      </div>
    </div>
  );
}
