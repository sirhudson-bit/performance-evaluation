import { Router } from 'express';
import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import {
  loginSchema,
  changePasswordSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  updateProfileSchema,
  mfaCodeSchema,
  tourProgressSchema,
  consentSchema,
  otpRequestSchema,
  otpVerifySchema,
} from '@pe/validation';
import { db } from '../../db.js';
import { config } from '../../config.js';
import { asyncHandler, badRequest, conflict, sendData, serviceUnavailable, unauthorized } from '../../lib/http.js';
import { hmacSha256, randomToken, safeEqual, sha256 } from '../../lib/crypto.js';
import { createSession, destroySession, destroyUserSessions } from '../../lib/sessions.js';
import { recordAudit } from '../../lib/audit.js';
import { sendMail } from '../../lib/mailer.js';
import { otpMessage, readSmsSettings, sendSms } from '../../lib/sms.js';
import { attachAuth, getAuth, requireAuth, SESSION_COOKIE } from '../../middleware/auth.js';
import { issueCsrf } from '../../middleware/csrf.js';
import { loginLimiter, otpRequestLimiter, otpVerifyLimiter, resetLimiter } from '../../middleware/rateLimit.js';
import { validateBody } from '../../middleware/validate.js';

export const authRouter = Router();
authRouter.use(attachAuth);

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.isProd,
  path: '/',
  maxAge: config.SESSION_TTL_SECONDS * 1000,
};

function publicUser(user: {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  mfaEnabled: boolean;
  preferredLanguage: string;
  themePreference: string;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    status: user.status,
    mfaEnabled: user.mfaEnabled,
    preferredLanguage: user.preferredLanguage,
    themePreference: user.themePreference,
  };
}

// --- CSRF bootstrap --------------------------------------------------------
authRouter.get('/csrf', (req, res) => {
  const token = issueCsrf(res);
  sendData(res, { csrfToken: token });
});

// --- Session ---------------------------------------------------------------
authRouter.post(
  '/login',
  loginLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password, totp } = req.body as { email: string; password: string; totp?: string };

    const user = await db.user.findFirst({
      where: { email },
      orderBy: { id: 'asc' },
      include: { roles: { include: { role: true } } },
    });

    // Identical message for unknown email and wrong password (no enumeration).
    const invalid = unauthorized('ایمیل یا رمز عبور نادرست است.');
    if (!user) throw invalid;
    if (!bcrypt.compareSync(password, user.passwordHash)) throw invalid;
    if (user.status !== 'active') throw unauthorized('حساب کاربری فعال نیست.');

    if (user.mfaEnabled && user.mfaSecret) {
      if (!totp) throw badRequest('کد تأیید دومرحله‌ای را وارد کنید.');
      const ok = authenticator.check(totp, user.mfaSecret);
      if (!ok) throw unauthorized('کد تأیید دومرحله‌ای نادرست است.');
    }

    const token = await createSession(user.id, { ip: req.ip, userAgent: req.get('user-agent') });
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    res.cookie(SESSION_COOKIE, token, cookieOptions);
    issueCsrf(res); // rotate the CSRF token on privilege change

    await recordAudit(
      { organizationId: user.organizationId, actorUserId: user.id, action: 'auth.login', entityType: 'user', entityId: user.id },
      req,
    );

    sendData(res, { user: publicUser(user) });
  }),
);

// --- One-time password (OTP) login ----------------------------------------
const OTP_TTL_MS = 2 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function otpHash(userId: number, code: string): string {
  // Keyed with APP_KEY so a leaked database row cannot be brute-forced offline.
  return hmacSha256(`${userId}:${code}`, `login-otp:${config.APP_KEY}`);
}

function normalizeOtpDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '');
}

/** OTP settings are per organization; a platform admin without one uses the first. */
async function smsOrganizationId(organizationId: number | null): Promise<number> {
  if (organizationId) return organizationId;
  const organization = await db.organization.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
  if (!organization) throw serviceUnavailable('سازمانی برای ارسال پیامک تنظیم نشده است.');
  return organization.id;
}

authRouter.post(
  '/otp/request',
  otpRequestLimiter,
  validateBody(otpRequestSchema),
  asyncHandler(async (req, res) => {
    const { email } = req.body as { email: string };
    const user = await db.user.findFirst({
      where: { email },
      orderBy: { id: 'asc' },
      select: { id: true, name: true, phone: true, status: true, organizationId: true },
    });

    // Always answer identically so the form cannot be used to discover accounts.
    const generic = {
      ok: true,
      expiresIn: Math.floor(OTP_TTL_MS / 1000),
      message: 'اگر حسابی با این ایمیل و شماره همراه ثبت‌شده وجود داشته باشد، کد ورود ارسال شد.',
    };
    if (!user || user.status !== 'active' || !user.phone) {
      sendData(res, generic);
      return;
    }

    const organizationId = await smsOrganizationId(user.organizationId);
    const settings = await readSmsSettings(organizationId);
    if (!settings.enabled || !settings.otpEnabled) {
      throw badRequest('ورود با رمز یک‌بار مصرف در حال حاضر فعال نیست. با رمز عبور وارد شوید.');
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await db.$transaction([
      db.loginOtp.deleteMany({ where: { userId: user.id, consumedAt: null } }),
      db.loginOtp.create({
        data: {
          userId: user.id,
          codeHash: otpHash(user.id, code),
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
        },
      }),
    ]);

    const result = await sendSms({
      organizationId,
      to: user.phone,
      // With a service pattern the panel owns the wording and expects only the
      // variable value (the code); otherwise send the configured template.
      text: settings.otpPatternId ? code : otpMessage(settings.otpText, code),
      kind: 'otp',
      recipientUserId: user.id,
      recipientName: user.name,
      pattern: true,
    });
    if (!result.sent) {
      console.error('[auth] OTP SMS failed:', result.error);
      throw serviceUnavailable('ارسال پیامک ممکن نشد. لطفاً کمی بعد دوباره تلاش کنید یا با مدیر سامانه تماس بگیرید.');
    }

    await recordAudit(
      {
        organizationId,
        actorUserId: user.id,
        action: 'auth.otp_requested',
        entityType: 'user',
        entityId: user.id,
        after: { expiresInSeconds: Math.floor(OTP_TTL_MS / 1000) },
      },
      req,
    );
    sendData(res, generic);
  }),
);

authRouter.post(
  '/otp/verify',
  otpVerifyLimiter,
  validateBody(otpVerifySchema),
  asyncHandler(async (req, res) => {
    const { email } = req.body as { email: string };
    const code = normalizeOtpDigits((req.body as { code: string }).code);
    const invalid = badRequest('کد وارد‌شده نامعتبر یا منقضی شده است. دوباره درخواست کنید.');

    const user = await db.user.findFirst({
      where: { email },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        mfaEnabled: true,
        preferredLanguage: true,
        themePreference: true,
        organizationId: true,
      },
    });
    if (!user || user.status !== 'active') throw invalid;

    const otp = await db.loginOtp.findFirst({
      where: { userId: user.id, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.expiresAt < new Date() || otp.attempts >= OTP_MAX_ATTEMPTS) throw invalid;

    if (!safeEqual(otp.codeHash, otpHash(user.id, code))) {
      await db.loginOtp.update({
        where: { id: otp.id },
        data: {
          attempts: { increment: 1 },
          ...(otp.attempts + 1 >= OTP_MAX_ATTEMPTS ? { consumedAt: new Date() } : {}),
        },
      });
      throw invalid;
    }

    // Single use: consume before creating the session so a replay always fails.
    await db.loginOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    const token = await createSession(user.id, { ip: req.ip, userAgent: req.get('user-agent') });
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    res.cookie(SESSION_COOKIE, token, cookieOptions);
    issueCsrf(res);
    await recordAudit(
      {
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: 'auth.login_otp',
        entityType: 'user',
        entityId: user.id,
      },
      req,
    );
    sendData(res, { user: publicUser(user) });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) await destroySession(token);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    sendData(res, { ok: true });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const user = await db.user.findUniqueOrThrow({
      where: { id: auth.id },
      include: { roles: { include: { role: true } }, employee: true, organization: true, department: true },
    });

    sendData(res, {
      user: publicUser(user),
      roles: user.roles.map((r) => ({ key: r.role.key, name: r.role.name })),
      permissions: auth.permissions,
      department: user.department ? { id: user.department.id, name: user.department.name } : null,
      employee: user.employee
        ? { id: user.employee.id, employeeNo: user.employee.employeeNo, firstName: user.employee.firstName, lastName: user.employee.lastName }
        : null,
      organization: user.organization
        ? { id: user.organization.id, name: user.organization.name, timezone: user.organization.timezone, calendar: user.organization.calendar }
        : null,
    });
  }),
);

// --- Password change / reset ----------------------------------------------
authRouter.post(
  '/password',
  requireAuth,
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };

    const user = await db.user.findUniqueOrThrow({ where: { id: auth.id } });
    if (!bcrypt.compareSync(currentPassword, user.passwordHash)) throw badRequest('رمز عبور فعلی نادرست است.');

    await db.user.update({ where: { id: user.id }, data: { passwordHash: bcrypt.hashSync(newPassword, 12) } });
    // Revoke every other session, then re-issue one for the current device.
    await destroyUserSessions(user.id);
    const token = await createSession(user.id, { ip: req.ip, userAgent: req.get('user-agent') });
    res.cookie(SESSION_COOKIE, token, cookieOptions);

    await recordAudit({ organizationId: user.organizationId, actorUserId: user.id, action: 'auth.password_changed', entityType: 'user', entityId: user.id }, req);
    sendData(res, { ok: true });
  }),
);

authRouter.post(
  '/password/request',
  resetLimiter,
  validateBody(requestPasswordResetSchema),
  asyncHandler(async (req, res) => {
    const { email } = req.body as { email: string };
    const user = await db.user.findFirst({ where: { email } });

    // Always answer the same way, whether or not the account exists.
    if (user && user.status === 'active') {
      const token = randomToken(32);
      await db.passwordResetToken.create({
        data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      });
      const link = `${config.APP_URL}/reset-password?token=${token}`;
      await sendMail({
        to: user.email,
        subject: 'بازیابی رمز عبور',
        text: `برای تغییر رمز عبور از پیوند زیر استفاده کنید (اعتبار یک ساعت):\n${link}`,
      });
    }

    sendData(res, { ok: true, message: 'اگر حسابی با این ایمیل وجود داشته باشد، پیوند بازیابی ارسال می‌شود.' });
  }),
);

authRouter.post(
  '/password/reset',
  resetLimiter,
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body as { token: string; newPassword: string };
    const hash = sha256(token);

    const record = await db.passwordResetToken.findUnique({ where: { tokenHash: hash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw badRequest('پیوند بازیابی نامعتبر یا منقضی شده است.');
    }

    await db.$transaction([
      db.user.update({ where: { id: record.userId }, data: { passwordHash: bcrypt.hashSync(newPassword, 12) } }),
      db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      db.session.deleteMany({ where: { userId: record.userId } }),
    ]);

    await recordAudit({ organizationId: null, actorUserId: record.userId, action: 'auth.password_reset', entityType: 'user', entityId: record.userId }, req);
    sendData(res, { ok: true });
  }),
);

// --- Profile ---------------------------------------------------------------
authRouter.patch(
  '/profile',
  requireAuth,
  validateBody(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const patch = req.body as { name?: string; phone?: string | undefined; themePreference?: string };

    // Only self-serviceable fields are accepted; admin fields are never mass-assigned.
    const updated = await db.user.update({
      where: { id: auth.id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone ?? null } : {}),
        ...(patch.themePreference !== undefined ? { themePreference: patch.themePreference } : {}),
      },
    });

    await recordAudit({ organizationId: auth.organizationId, actorUserId: auth.id, action: 'profile.updated', entityType: 'user', entityId: auth.id, after: { name: updated.name, phone: updated.phone } }, req);
    sendData(res, { user: publicUser(updated) });
  }),
);

// --- MFA (optional, for privileged accounts) -------------------------------
authRouter.post(
  '/mfa/setup',
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const secret = authenticator.generateSecret();
    await db.user.update({ where: { id: auth.id }, data: { mfaSecret: secret, mfaEnabled: false } });
    const uri = authenticator.keyuri(auth.email, config.APP_NAME, secret);
    sendData(res, { secret, uri });
  }),
);

authRouter.post(
  '/mfa/enable',
  requireAuth,
  validateBody(mfaCodeSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const { code } = req.body as { code: string };
    const user = await db.user.findUniqueOrThrow({ where: { id: auth.id } });
    if (!user.mfaSecret) throw conflict('ابتدا مرحله راه‌اندازی را انجام دهید.');
    if (!authenticator.check(code, user.mfaSecret)) throw badRequest('کد وارد‌شده نادرست است.');
    await db.user.update({ where: { id: user.id }, data: { mfaEnabled: true } });
    sendData(res, { ok: true });
  }),
);

authRouter.post(
  '/mfa/disable',
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    await db.user.update({ where: { id: auth.id }, data: { mfaEnabled: false, mfaSecret: null } });
    sendData(res, { ok: true });
  }),
);

// --- Tour progress ---------------------------------------------------------
authRouter.post(
  '/tours',
  requireAuth,
  validateBody(tourProgressSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const { tourKey, status } = req.body as { tourKey: string; status: string };
    await db.userHelpProgress.upsert({
      where: { userId_tourKey: { userId: auth.id, tourKey } },
      update: { status, completedAt: status === 'done' ? new Date() : null },
      create: { userId: auth.id, tourKey, status, completedAt: status === 'done' ? new Date() : null },
    });
    sendData(res, { ok: true });
  }),
);

// --- Consent ---------------------------------------------------------------
authRouter.get(
  '/consent',
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const row = auth.organizationId
      ? await db.consentPreference.findUnique({ where: { organizationId_userId: { organizationId: auth.organizationId, userId: auth.id } } })
      : null;
    sendData(res, { categories: (row?.categories as Record<string, boolean>) ?? { necessary: true }, policyVersion: row?.policyVersion ?? '1.0' });
  }),
);

authRouter.put(
  '/consent',
  requireAuth,
  validateBody(consentSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const { categories, policyVersion } = req.body as { categories: Record<string, boolean>; policyVersion: string };
    // Strictly-necessary is always on and cannot be turned off.
    const merged = { ...categories, necessary: true };

    if (!auth.organizationId) throw badRequest('حساب کاربری به سازمانی متصل نیست.');

    await db.consentPreference.upsert({
      where: { organizationId_userId: { organizationId: auth.organizationId, userId: auth.id } },
      update: { categories: merged, policyVersion, ipAddress: req.ip ?? null },
      create: { organizationId: auth.organizationId, userId: auth.id, categories: merged, policyVersion, ipAddress: req.ip ?? null },
    });

    await recordAudit({ organizationId: auth.organizationId, actorUserId: auth.id, action: 'consent.updated', entityType: 'consent_preference', entityId: auth.id, after: merged }, req);
    sendData(res, { ok: true });
  }),
);
