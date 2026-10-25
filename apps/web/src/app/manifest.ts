import type { MetadataRoute } from 'next';

// Read the (non-sensitive) PWA settings at request time so an administrator's
// changes take effect without a rebuild.
export const dynamic = 'force-dynamic';

const API_URL = process.env.API_URL || 'http://127.0.0.1:4000';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let cfg = {
    name: 'سامانه ارزیابی عملکرد',
    shortName: 'ارزیابی',
    description: 'سامانه ارزیابی عملکرد کارکنان سازمان',
    themeColor: '#1e3a8a',
    backgroundColor: '#f8fafc',
    display: 'standalone',
    orientation: 'portrait',
  };

  try {
    const res = await fetch(`${API_URL}/api/v1/public/config`, { cache: 'no-store' });
    if (res.ok) {
      const json = (await res.json()) as { data?: { platformName?: string; pwa?: Partial<typeof cfg> } };
      if (json.data?.pwa) cfg = { ...json.data.pwa } as typeof cfg;
    }
  } catch {
    /* fall back to defaults when the API is unreachable */
  }

  return {
    name: cfg.name,
    short_name: cfg.shortName,
    description: cfg.description,
    start_url: '/dashboard',
    display: (cfg.display as MetadataRoute.Manifest['display']) ?? 'standalone',
    orientation: cfg.orientation as MetadataRoute.Manifest['orientation'],
    background_color: cfg.backgroundColor,
    theme_color: cfg.themeColor,
    dir: 'rtl',
    lang: 'fa',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
