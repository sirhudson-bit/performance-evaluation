import { Router } from 'express';
import { smsSettingsSchema, smsSendSchema, smsTestSchema } from '@pe/validation';
import { db } from '../../db.js';
import { asyncHandler, badRequest, sendData } from '../../lib/http.js';
import { recordAudit } from '../../lib/audit.js';
import { readSmsSettings, sendSms, writeSmsSettings, type SmsSettings } from '../../lib/sms.js';
import { getAuth, requirePermission } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/scope.js';
import { validateBody } from '../../middleware/validate.js';

export const smsRouter = Router();

/** Roles that count as "manager" for the recipient picker. */
const MANAGER_ROLE_KEYS = ['department_manager', 'hr_manager', 'system_admin', 'platform_super_admin'];

/** Strips the panel password before anything leaves the API. */
function publicSettings(settings: SmsSettings) {
  const { password: _password, ...safe } = settings;
  return { ...safe, provider: 'melipayamak' as const, docsUrl: 'https://www.melipayamak.com/api/' };
}

smsRouter.get(
  '/settings',
  requirePermission('settings.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const organizationId = requireOrganization(auth);
    sendData(res, { settings: publicSettings(await readSmsSettings(organizationId)) });
  }),
);

smsRouter.put(
  '/settings',
  requirePermission('settings.manage'),
  validateBody(smsSettingsSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const organizationId = requireOrganization(auth);
    const body = req.body as {
      enabled: boolean;
      username?: string;
      password?: string;
      from?: string;
      baseUrl?: string;
      otpEnabled?: boolean;
      otpText?: string;
      otpPatternId?: string;
    };

    const settings = await writeSmsSettings(organizationId, body);
    await recordAudit(
      {
        organizationId,
        actorUserId: auth.id,
        action: 'sms.settings_updated',
        entityType: 'setting',
        after: {
          enabled: settings.enabled,
          username: settings.username,
          from: settings.from,
          otpEnabled: settings.otpEnabled,
          passwordChanged: Boolean(body.password),
        },
      },
      req,
    );
    sendData(res, {
      settings: publicSettings(settings),
      note: settings.configured
        ? 'اتصال پنل پیامکی ذخیره شد.'
        : 'ذخیره شد؛ برای فعال‌شدن ارسال، نام کاربری، رمز، خط ارسال و گزینه «فعال» لازم است.',
    });
  }),
);

/** Users with a mobile number, used by the recipient picker. */
smsRouter.get(
  '/recipients',
  requirePermission('settings.manage'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const organizationId = requireOrganization(auth);
    const users = await db.user.findMany({
      where: { organizationId, status: 'active', phone: { not: null } },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isPlatformAdmin: true,
        roles: { select: { role: { select: { key: true, name: true } } } },
      },
      orderBy: { name: 'asc' },
      take: 1000,
    });
    sendData(res, {
      items: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isManager: user.isPlatformAdmin || user.roles.some((r) => MANAGER_ROLE_KEYS.includes(r.role.key)),
        roles: user.roles.map((r) => r.role.name),
      })),
    });
  }),
);

function audienceWhere(organizationId: number, audience: string, userId?: number) {
  const base = { organizationId, status: 'active', phone: { not: null } } as const;
  if (audience === 'user') {
    if (!userId) throw badRequest('کاربر گیرنده را انتخاب کنید.', [{ path: 'userId', message: 'کاربر گیرنده الزامی است.' }]);
    return { ...base, id: userId };
  }
  if (audience === 'managers') {
    return {
      ...base,
      OR: [
        { isPlatformAdmin: true },
        { roles: { some: { role: { key: { in: MANAGER_ROLE_KEYS } } } } },
      ],
    };
  }
  if (audience === 'staff') {
    return {
      ...base,
      isPlatformAdmin: false,
      roles: { none: { role: { key: { in: MANAGER_ROLE_KEYS } } } },
    };
  }
  return base;
}

smsRouter.post(
  '/send',
  requirePermission('settings.manage'),
  validateBody(smsSendSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const organizationId = requireOrganization(auth);
    const body = req.body as { audience: string; userId?: number; text: string };

    const recipients = await db.user.findMany({
      where: audienceWhere(organizationId, body.audience, body.userId),
      select: { id: true, name: true, phone: true },
      orderBy: { name: 'asc' },
      take: 201,
    });
    if (recipients.length === 0) throw badRequest('هیچ گیرنده‌ای با شماره همراه ثبت‌شده پیدا نشد.');
    if (recipients.length > 200) throw badRequest('تعداد گیرندگان بیش از ۲۰۰ نفر است؛ پیام را به گروه کوچک‌تری بفرستید.');

    let sent = 0;
    const failures: { name: string; phone: string; error: string }[] = [];
    // Four at a time keeps the bulk send quick without hammering the panel.
    for (let index = 0; index < recipients.length; index += 4) {
      const batch = recipients.slice(index, index + 4);
      const results = await Promise.all(
        batch.map(async (recipient) => {
          const result = await sendSms({
            organizationId,
            to: recipient.phone ?? '',
            text: body.text,
            kind: 'system',
            senderUserId: auth.id,
            recipientUserId: recipient.id,
            recipientName: recipient.name,
          });
          return { recipient, result };
        }),
      );
      for (const { recipient, result } of results) {
        if (result.sent) sent += 1;
        else failures.push({ name: recipient.name, phone: recipient.phone ?? '', error: result.error ?? 'خطای نامشخص' });
      }
    }

    await recordAudit(
      {
        organizationId,
        actorUserId: auth.id,
        action: 'sms.bulk_sent',
        entityType: 'sms_message',
        after: { audience: body.audience, total: recipients.length, sent, failed: failures.length },
      },
      req,
    );

    sendData(res, {
      total: recipients.length,
      sent,
      failed: failures.length,
      failures: failures.slice(0, 10),
    });
  }),
);

smsRouter.post(
  '/test',
  requirePermission('settings.manage'),
  validateBody(smsTestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const organizationId = requireOrganization(auth);
    const { to } = req.body as { to: string };
    const result = await sendSms({
      organizationId,
      to,
      text: 'پیام آزمایشی سامانه ارزیابی عملکرد؛ اتصال پنل پیامکی برقرار است.',
      kind: 'test',
      senderUserId: auth.id,
      ignoreEnabled: true,
    });
    await recordAudit(
      {
        organizationId,
        actorUserId: auth.id,
        action: 'sms.test_sent',
        entityType: 'sms_message',
        after: { sent: result.sent, error: result.error ?? null },
      },
      req,
    );
    sendData(res, result);
  }),
);

smsRouter.get(
  '/logs',
  requirePermission('settings.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const organizationId = requireOrganization(auth);
    const page = Math.max(1, Number(req.query.page ?? 1));
    const perPage = Math.min(100, Math.max(1, Number(req.query.perPage ?? 25)));
    const [items, total] = await Promise.all([
      db.smsMessage.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      db.smsMessage.count({ where: { organizationId } }),
    ]);
    sendData(res, { items, total, page, perPage });
  }),
);
