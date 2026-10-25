'use client';

import { DirectionProvider } from '@radix-ui/react-direction';
import * as Tooltip from '@radix-ui/react-tooltip';

/**
 * Supplies the app's RTL direction explicitly — third-party UI primitives read
 * direction from their own providers, not from `<html dir="rtl">`.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DirectionProvider dir="rtl">
      <Tooltip.Provider delayDuration={200}>{children}</Tooltip.Provider>
    </DirectionProvider>
  );
}
