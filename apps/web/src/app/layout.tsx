import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';
import { Providers } from '@/components/Providers';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';

export const metadata: Metadata = {
  title: 'سامانه ارزیابی عملکرد',
  description: 'سامانه ارزیابی عملکرد کارکنان سازمان',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#1e3a8a',
  width: 'device-width',
  initialScale: 1,
};

/** Applies the stored theme before paint to avoid a flash (FOUC). */
const themeScript = `try{var t=localStorage.getItem('pe_theme');if(t==='dark'){document.documentElement.classList.add('dark')}else if(!t&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark')}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>
        <a href="#main" className="skip-link">
          پرش به محتوای اصلی
        </a>
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
