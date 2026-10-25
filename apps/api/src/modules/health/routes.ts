import { Router } from 'express';
import { db } from '../../db.js';
import { asyncHandler, sendData } from '../../lib/http.js';

export const healthRouter = Router();

/** Liveness/readiness probe. Never reveals secrets or internals. */
healthRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    let database = false;
    try {
      await db.$queryRaw`SELECT 1`;
      database = true;
    } catch {
      database = false;
    }
    sendData(res, {
      status: database ? 'ok' : 'degraded',
      database,
      time: new Date().toISOString(),
      version: '0.1.0',
    });
  }),
);

/**
 * Public, non-sensitive configuration used by the web app to build the PWA
 * manifest (so admin PWA settings take effect). Contains no secrets.
 */
healthRouter.get(
  '/public/config',
  asyncHandler(async (_req, res) => {
    const org = await db.organization.findFirst({ where: { status: 'active' }, orderBy: { id: 'asc' } });
    const rows = org ? await db.setting.findMany({ where: { organizationId: org.id } }) : [];
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;

    sendData(res, {
      platformName: settings.platform_name ?? 'سامانه ارزیابی عملکرد',
      organizationDisplayName: settings.organization_display_name ?? org?.name ?? null,
      pwa: {
        enabled: settings.pwa_enabled !== 'false',
        name: settings.pwa_name ?? settings.platform_name ?? 'سامانه ارزیابی عملکرد',
        shortName: settings.pwa_short_name ?? 'ارزیابی',
        description: settings.pwa_description ?? 'سامانه ارزیابی عملکرد کارکنان سازمان',
        themeColor: settings.pwa_theme_color ?? '#1e3a8a',
        backgroundColor: settings.pwa_background_color ?? '#f8fafc',
        display: settings.pwa_display ?? 'standalone',
        orientation: settings.pwa_orientation ?? 'portrait',
        installPrompt: settings.pwa_install_prompt !== 'false',
        offline: settings.pwa_offline !== 'false',
      },
    });
  }),
);
