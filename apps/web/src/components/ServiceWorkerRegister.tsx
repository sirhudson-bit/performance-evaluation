'use client';

import { useEffect } from 'react';

/**
 * Registers the PWA service worker — production only.
 *
 * In development a service worker is actively harmful: it can serve old
 * `/_next` JavaScript chunks against freshly-rendered HTML, which produces
 * hydration errors and a UI that looks "broken" or stale after an update. So in
 * development we *unregister* any existing worker and clear its caches.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => undefined);
      if (typeof caches !== 'undefined') {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => undefined);
      }
      return;
    }

    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    };
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  return null;
}
