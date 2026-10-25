# فصل ۴ — آموزش هر بخش

> **یک‌خطی:** هر ماژول بک‌اند، هر گروه صفحه فرانت‌اند و هر بسته مشترک، با مسئولیت، ورودی/خروجی، نمونه کد و نکات عملی توضیح داده می‌شود تا بتوانید هر بخش را مستقل بفهمید و تغییر دهید.

📍 بازگشت به [فهرست مطالب](./README.md)

---

## ۴.۱ نقشه کلی ماژول‌ها

| ماژول | مسئولیت | وابستگی اصلی | نمونه تست |
|---|---|---|---|
| `auth` | ورود/نشست/بازیابی رمز/پروفایل/رضایت/تور | `db`, `crypto`, `mailer`, `otplib` | `verify`: login، ۴۰۱ ناشناس |
| `users` | کاربران، نقش‌دهی، دپارتمان، بازنشانی رمز، حذف | `auth`, `crypto`, `config` | `verify`: ساخت/ویرایش/حذف کاربر |
| `roles` | نقش‌ها و کاتالوگ دسترسی | `shared/permissions` | `verify`: نقش سفارشی |
| `organization` | واحدها و سمت‌ها | `db` | `verify`: حذف واحد/سمت |
| `employees` | کارکنان + تاریخچه مدیریت | `scope` | `verify`: محدوده مدیر |
| `questions` | بانک پرسش + نسخه تغییرناپذیر | `service.createQuestionVersion` | `tests/unit` (نسخه) |
| `forms` | فرم/نسخه/بخش/پیش‌نمایش/انتشار | `scoring`, `formula` | `verify`: انتشار v1 |
| `cycles` | دوره، ارجاع، زمان‌بندی، داشبورد | `workflow` | `verify`: ایجاد/فعال‌سازی |
| `evaluations` | پاسخ، ارسال، بررسی، انتشار، نتایج، اعتراض | `scoring`, `formula` | `verify`: امتیاز ۷۲.۵۳ |
| `compensation` | سیاست، پیشنهاد، تأیید | `Decimal` | `verify`: تأیید HR |
| `processes` | فرایند، مراحل، ابعاد | `db` | `verify`: مرحله/بعد |
| `agreements` | توافق‌نامه، شاخص، پیشرفت، لاگ | `scope` | `verify`: پیشرفت/لاگ |
| `reports` | خروجی/ورود اکسل، تحلیل | `exceljs`, `jobs` | `verify`: دانلود xlsx |
| `ai` | سرویس‌ها، مدل‌ها، گفتگو، مصرف | `crypto`, `adapters` | `verify`: ۵۰۳ → محلی |
| `help` | مقالات/FAQ/واژه‌نامه | `text.faContains` | مرکز راهنما |
| `tickets` | پیام و تیکت | `scope` | `verify`: ۴۰۳ کارمند |
| `admin` | تنظیمات، انطباق، حسابرسی، امنیت | `db`, `audit` | `verify`: پاک‌سازی audit |
| `jobs` | درین صف با توکن | `jobs` lib | `verify`: درین خروجی |
| `health` | سلامت + پیکربندی عمومی PWA | `db` | `verify`: health / PWA |

---

## ۴.۲ ماژول `auth` — احراز هویت و نشست

**🎯 مسئولیت:** ورود/خروج، نشست پایگاه‌داده‌محور، بازیابی رمز، MFA اختیاری، پروفایل خود، رضایت کوکی، پیشرفت تور.

**ورودی/خروجی:** ورودی JSON (Zod)؛ خروجی `{ data: … }` و کوکی `pe_session`.

📎 کد: `apps/api/src/middleware/auth.ts`

```ts
// بارگذاری نشست: «ردیف نشست» مرجع است، پس حذف آن = خروج فوری
export async function loadSession(req: Request): Promise<AuthUser | null> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;

  const session = await db.session.findUnique({ where: { id: token } });
  if (!session?.userId) return null;

  // عمر لغزان: نشست فعال وسط کار قطع نمی‌شود
  const now = Math.floor(Date.now() / 1000);
  if (now - session.lastActivity > config.SESSION_TTL_SECONDS) {
    await db.session.deleteMany({ where: { id: token } });   // منقضی → حذف
    return null;
  }
  if (now - session.lastActivity > 60) {
    await db.session.update({ where: { id: token }, data: { lastActivity: now } });
  }
  // … بارگذاری نقش‌ها و دسترسی‌ها؛ مدیر ارشد همه دسترسی‌ها را دارد
}
```

**سناریوی واقعی:** کارمند با ایمیل/رمز وارد می‌شود؛ پیام خطای «ایمیل یا رمز نادرست» برای ایمیل ناموجود و رمز غلط **یکسان** است تا حساب‌ها قابل شناسایی نباشند.

> ⚠️ رمز با `bcrypt` هزینه ۱۲ درهم‌سازی می‌شود؛ رمز خام هرگز ذخیره/لاگ نمی‌شود.
> 💡 پس از تغییر رمز، **همه نشست‌های دیگر باطل** می‌شوند و یک نشست تازه برای دستگاه فعلی صادر می‌شود.
> 🔧 محدودسازی ورود: `loginLimiter` روی `POST /auth/login` (۸ تلاش در ۵ دقیقه به‌ازای IP).

**تست نمونه (E2E):** `verify` بررسی می‌کند `GET /auth/me` ناشناس → ۴۰۱ و ورود مدیر موفق باشد.

---

## ۴.۳ ماژول `users` — کاربران، دپارتمان، بازنشانی رمز، حذف

**🎯 مسئولیت:** مدیریت حساب‌ها، نقش‌دهی، دپارتمان/واحد کاری، وضعیت، و دو عمل حساس: **بازنشانی رمز** و **حذف**.

📎 کد: `apps/api/src/modules/users/routes.ts`

```ts
// بازنشانی رمز: هرگز رمز فعلی افشا نمی‌شود؛ فقط پیوند یک‌بارمصرف صادر می‌شود
usersRouter.post('/:id/reset-password', requirePermission('users.edit'), asyncHandler(async (req, res) => {
  const target = await db.user.findFirst({ where: { id, organizationId: orgId } });
  const token = randomToken(32);
  await db.passwordResetToken.create({ data: { userId: target.id, tokenHash: sha256(token), expiresAt: /* +۱ ساعت */ } });
  const link = `${config.APP_URL}/reset-password?token=${token}`;
  await sendMail({ to: target.email, subject: 'بازنشانی رمز عبور', text: link });   // اگر SMTP نبود، فقط لاگ می‌شود
  sendData(res, { ok: true, link, emailed: mail.sent });
}));
```

```ts
// حذف: پیش‌فرض «بایگانی» (?hard=1 برای حذف دائمی) + بستن نشست‌ها
if (id === auth.id) throw badRequest('امکان حذف حساب خودتان وجود ندارد.');       // محافظ ۱
if (isPlatform && platformCount <= 1) throw conflict('آخرین مدیر ارشد قابل حذف نیست.'); // محافظ ۲
await db.session.deleteMany({ where: { userId: id } });                          // قطع فوری دسترسی
```

**سناریو:** مدیر سامانه رمز یک کارمند را «بازنشانی» می‌کند؛ پیوند یک‌بارمصرف را به او می‌دهد و کارمند خودش رمز تازه می‌گذارد.

> ⚠️ حذف مالک ردیف، نشست‌ها/نقش‌ها/رضایت‌ها را آبشاری پاک می‌کند؛ در حالت «بایگانی» تاریخچه حفظ می‌شود (توصیه‌شده).
> 💡 دپارتمان کاربر به `organization_units` وصل است، نه یک متن آزاد — تا با واحدها یکدست بماند.

---

## ۴.۴ ماژول `organization` و `employees`

**🎯 مسئولیت:** ساختار سازمانی (واحدها/سمت‌ها) و کارکنان + **تاریخچه مدیریت با تاریخ مؤثر**.

📎 کد: `apps/api/src/modules/organization/routes.ts`

```ts
// حذف واحد: اگر کارمند یا زیرواحد دارد → بایگانی (حفظ تاریخچه)، وگرنه حذف
if (unit._count.employees > 0 || unit._count.children > 0) {
  await db.organizationUnit.update({ where: { id }, data: { status: 'archived' } });
  sendData(res, { ok: true, archived: true });
  return;
}
await db.organizationUnit.delete({ where: { id } });
```

📎 کد: `apps/api/src/modules/employees/routes.ts`

```ts
// تغییر مدیر: ابتدا رکورد باز قبلی بسته می‌شود، سپس رکورد تازه با «تاریخ مؤثر» باز می‌شود
await db.employeeManagerHistory.updateMany({ where: { employeeId: id, effectiveTo: null }, data: { effectiveTo: body.effectiveFrom } });
await db.employeeManagerHistory.create({ data: { employeeId: id, managerEmployeeId: body.managerEmployeeId, effectiveFrom: body.effectiveFrom } });
```

**سناریو:** کارمندی از واحد «توسعه» به «بازاریابی» می‌رود؛ تاریخچه نگه داشته می‌شود تا معلوم باشد در ارزیابی بهمن‌ماه زیر نظر چه کسی بوده.

> 📌 فهرست کارکنان با `resolveEmployeeScope` محدود می‌شود: مدیر فقط خودش + زیرمجموعه‌هایش را می‌بیند.

---

## ۴.۵ ماژول `questions` و `forms` — بانک پرسش و نسخه‌گذاری

**🎯 مسئولیت:** پرسش‌ها، دسته‌ها، گزینه‌ها و **نسخه تغییرناپذیر**؛ فرم‌ها، بخش‌ها، وزن‌ها، پیش‌نمایش و انتشار.

📎 کد: `apps/api/src/modules/questions/service.ts`

```ts
// هر ویرایش پرسش، یک نسخه «فریز‌شده» می‌سازد؛ فرم منتشرشده به نسخه ارجاع می‌دهد نه به پرسش متغیر
export async function createQuestionVersion(questionId: number, version: number, createdBy?: number | null) {
  const question = await db.question.findUniqueOrThrow({ where: { id: questionId }, include: { options: true } });
  const snapshot = { /* عنوان، متن، نوع پاسخ، وزن، پرسش‌های وابسته، گزینه‌ها با امتیاز */ };
  return db.questionVersion.upsert({ where: { questionId_version: { questionId, version } }, update: { snapshot }, create: { questionId, version, snapshot } });
}
```

📎 کد: `apps/api/src/modules/forms/routes.ts`

```ts
// انتشار: اعتبارسنجی وزن‌ها، تثبیت نسخه، اجازه ندادن به ویرایش بعدی
const warnings = validateAndNormalizeWeights(sectionWeights, sections, questionWeightErrors);
if (questionWeightErrors.length > 0) throw badRequest(questionWeightErrors.join(' '));
await db.$transaction([
  db.formVersion.update({ where: { id: version.id }, data: { status: 'published', publishedAt: new Date() } }),
  db.evaluationForm.update({ where: { id: version.formId }, data: { status: 'published', currentVersion: version.version } }),
]);
```

> ⚠️ **هشدار حیاتی:** نسخه منتشرشده قابل ویرایش نیست؛ برای تغییر، **نسخه جدید** بسازید. نتیجه‌های تاریخی هرگز با تغییر پرسش بازمحاسبه نمی‌شوند.
> 💡 فرمِ استفاده‌شده در دوره حذف نمی‌شود؛ فقط **بایگانی** می‌شود.

**تست نمونه:** `verify` وجود «یک نسخه منتشرشده» و ایجاد فرم/حذف فرم استفاده‌نشده را بررسی می‌کند.

---

## ۴.۶ ماژول `cycles` — دوره، ارجاع، زمان‌بندی

**🎯 مسئولیت:** دوره‌ها (بازه، سیاست امتیاز، محرمانگی)، **ارجاع ارزیاب‌ها**، **گذار وضعیت معتبرشده**، زمان‌بندی مراحل و داشبورد تکمیل.

📎 کد: `apps/api/src/modules/cycles/routes.ts`

```ts
// گذار وضعیت: فقط گذارهای مجاز (مثلاً draft→active)، نه پرش با درخواست مستقیم
try { assertTransition(CYCLE_TRANSITIONS, cycle.status as CycleStatus, status, 'وضعیت دوره'); }
catch (e) { throw conflict(e.message); }
```

```ts
// ارجاع گروهی: مدیر مستقیم بر پایه «تاریخچه» در تاریخ شروع دوره تعیین می‌شود
const managerId = await resolveManager(orgId, employee.id, cycle.startDate, body.strategy /* manager_history | current_manager */);
```

**سناریو:** مدیر سامانه دوره «بهار ۱۴۰۵» را با ۱۲ کارمند و دو نقش (خودارزیابی ۳۰٪، مدیر ۷۰٪) ارجاع می‌دهد؛ سپس از `POST /cycles/:id/steps/from-process` زمان‌بندی مراحل را از فرایند می‌سازد.

> 💡 مراحل دوره (`cycle_steps`) تاریخ سررسید را از `slaDays` فرایند و تاریخ شروع دوره محاسبه می‌کنند.

---

## ۴.۷ ماژول `evaluations` — قلب گردش‌کار

**🎯 مسئولیت:** پاسخ‌های من، ذخیره پیش‌نویس، ارسال، بررسی/تأیید/بازگرداندن، بازگشایی، انتشار، نتایج، اعتراض‌ها و برنامه‌های بهبود.

📎 کد: `apps/api/src/modules/evaluations/routes.ts`

```ts
// ارسال: گذار وضعیت + اعتبارسنجی پرسش‌های الزامی، سپس محاسبه امتیاز
assertTransition(ASSIGNMENT_TRANSITIONS, assignment.status as AssignmentStatus, 'submitted', 'وضعیت ارزیابی');
for (const fq of assignment.formVersion.questions) {
  if (!fq.required) continue;
  const r = responseByFq.get(fq.id);
  const answered = r && r.value != null && String(r.value).trim() !== '';
  if (!r || (!answered && !r.isNotApplicable)) missing.push(String(fq.id));   // «مصداق ندارد» مانع ارسال نیست
}
if (missing.length > 0) throw badRequest('پرسش‌های الزامی پاسخ داده نشده‌اند.');
await computeAssignmentScores(id);        // محاسبه امتیاز بخش/فرم
```

```ts
// انتشار: مرحله ناتمام = جلوگیری، با ثبت دلیل در «blocked»
const result = await computeFinalResult(cycleId, employeeId);
if (!result.complete) { blocked.push({ employeeId, reason: 'برخی ارزیابان ارسال نکرده‌اند.' }); continue; }
await db.finalEvaluationResult.update({ where: { cycleId_employeeId: { cycleId, employeeId } }, data: { status: 'published', publishedAt: new Date() } });
```

> ⚠️ پس از انتشار، تغییر فقط با **بازگشایی مجاز** و ثبت دلیل؛ نتیجه اصلی حذف نمی‌شود.
> 💡 پاسخ «خودارزیابی» و «مدیر» جدا ثبت می‌شوند و وزن هر ارزیاب در امتیاز نهایی اثر دارد.

**تست نمونه:** `verify` چرخه شرش را کامل اجرا و امتیاز نهایی **۷۲.۵۳** را تأیید می‌کند.

---

## ۴.۸ ماژول `processes` و `agreements` — مدیریت عملکرد

**🎯 مسئولیت:** طراحی **فرایند** (مدل ارزیابی، مراحل با مسئول/SLA، ابعاد با مسئول) و **توافق‌نامه‌های فردی** (شاخص، هدف/واقعی، پیشرفت، لاگ رخداد).

📎 کد: `apps/api/src/modules/agreements/routes.ts`

```ts
// ثبت پیشرفت شاخص (۰–۱۰۰) و مقدار واقعی
await db.agreementIndicator.update({
  where: { id: indicatorId },
  data: { ...(body.actualValue != null ? { actualValue: new Prisma.Decimal(body.actualValue) } : {}), ...(body.progress != null ? { progress: body.progress } : {}) },
});
```

```ts
// دسترسی: توافق‌نامه فقط برای کارکنان در محدوده کاربر
const scope = await resolveEmployeeScope(auth);
if (!scope.seesAll && !scope.employeeIds.includes(row.employeeId)) throw notFound();
```

**سناریو:** مدیر برای کارمند «رضایت مشتری: هدف ۹۰» ثبت می‌کند؛ وسط دوره مقدار واقعی ۸۰ و پیشرفت ۶۵٪ را می‌گذارد و بازخورد ثبت می‌کند.

> 💡 کارمند «**عملکرد من**» (`/my-performance`) را می‌بیند: آخرین امتیاز، توافق‌نامه‌ها با درصد پیشرفت و برنامه‌های بهبود.

---

## ۴.۹ ماژول `compensation` — پاداش و ارتقا (فقط پیشنهاد)

**🎯 مسئولیت:** سیاست‌های نسخه‌دار، تولید پیشنهاد از روی امتیاز، ویرایش پیش از تصمیم، و تأیید/رد با ثبت دلیل.

📎 کد: `apps/api/src/modules/compensation/routes.ts`

```ts
// محاسبه پیشنهاد: صرفاً «پیشنهاد» است؛ هیچ پرداختی خودکار اجرا نمی‌شود
export function computeRecommendation(score: number | null, rules: PolicyRule[]) {
  const rule = rules.find((r) => score >= r.minScore && score <= r.maxScore);
  if (!rule || score === null) return null;
  let value = rule.value;
  if (rule.min !== undefined) value = Math.max(rule.min, value);
  if (rule.max !== undefined) value = Math.min(rule.max, value);
  return { type: rule.type, value };             // نوع: درصد/مبلغ/ارتقا
}
```

> 📌 هیچ اجرای خودکار حقوق/پرداخت وجود ندارد؛ تصمیم نهایی با انسان مجاز است و تاریخچه نگه داشته می‌شود.
> ⚠️ تغییر مقدار پیشنهاد (override) بدون **دلیل** رد می‌شود.

---

## ۴.۱۰ ماژول `reports` — خروجی/ورود اکسل و تحلیل

**🎯 مسئولیت:** تولید xlsx/csv (پس‌زمینه‌ای)، ورود کارکنان از اکسل با پیش‌نمایش، و تحلیل نموداری.

📎 کد: `apps/api/src/lib/excel.ts`

```ts
// محافظت در برابر «تزریق فرمول»: کاراکترهای آغازگر فرمول بی‌اثر می‌شوند
export function sanitizeCell(value: unknown): CellValue {
  let text = String(value ?? '').replace(/[\u0000-\u001F]/g, '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;   // پیشوند آپاستروف → Excel متن می‌بیند
  return text;
}
```

```ts
// خروجی «پاسخ‌های کاربران» فقط برای مدیر ارشد
if (report === 'responses_by_user' && !auth.isPlatformAdmin && !auth.permissions.includes('settings.manage')) {
  throw forbidden('خروجی پاسخ‌های کاربران تنها برای مدیر سامانه مجاز است.');
}
```

> ⚠️ فایل‌های خروجی در `storage/` (خارج از `public/`) ذخیره و فقط از مسیر مجازدار و **منقضی‌شدنی** دانلود می‌شوند.
> 💡 دانلود هر فایل، مجوز + مالکیت + انقضا را دوباره بررسی می‌کند.

---

## ۴.۱۱ ماژول `ai` — آداپتورها و امنیت

**🎯 مسئولیت:** سرویس‌های AI (سازگار OpenAI / Gemini / محلی)، رمزنگاری کلید، سیاست کاربرد، گفتگو، و متریک مصرف.

📎 کد: `apps/api/src/lib/ai/adapters.ts`

```ts
// آداپتور توانمندی‌محور: هرگز فرض نمی‌کنیم همه سرویس‌ها سازگار OpenAI هستند
if (provider.type === 'openai_compatible') {
  const base = (provider.baseUrl || 'https://api.gapgpt.app/v1').replace(/\/+$/, '');
  // POST {base}/chat/completions  ← با Timeout و AbortController
}
// اگر /models پشتیبانی نشود → { supported: false } و مدل باید دستی تنظیم شود
```

> ⚠️ کلید سرویس هرگز در پاسخ API یا مرورگر ظاهر نمی‌شود (با AES-256-GCM رمزنگاری می‌شود).
> 📌 پیش‌فرض: **هیچ داده ارزیابی شخصی** به سرویس بیرونی فرستاده نمی‌شود؛ دستیار تصمیم‌گیر نیست.

---

## ۴.۱۲ ماژول‌های `help` / `tickets` / `admin` / `jobs` / `health`

| ماژول | نکته کلیدی |
|---|---|
| `help` | جستجو با **نرمال‌سازی فارسی** (`faContains`: ی/ك، نیم‌فاصله) |
| `tickets` | «همه» فقط با `tickets.manage`؛ کارمند فقط تیکت خودش (۴۰۳ در غیر این صورت) |
| `admin` | `DELETE /admin/audit/clear?days=30` برای جلوگیری از رشد بی‌رویه، خودش هم ثبت می‌شود |
| `jobs` | `POST /jobs/run` با توکن bearer؛ `/jobs` برای مشاهده |
| `health` | `/health` بدون افشای راز + `/public/config` برای مانیفست PWA |

---

## ۴.۱۳ فرانت‌اند — الگوها، صفحه و کامپوننت نمونه

**🎯 الگوی ثابت:** سرور‌کامپوننت می‌خواند، کلاینت‌کامپوننت تعامل می‌برد.

📎 کد: `apps/web/src/app/(app)/my-performance/page.tsx`

```tsx
// سرور‌کامپوننت: سه فراخوانی موازی برای ساخت «تصویر یکجای عملکرد من»
const [results, agreements, plans] = await Promise.all([
  apiData<{ items: Result[] }>('/evaluations/results/list'),
  apiData<{ items: Agreement[] }>('/agreements'),
  apiData<{ items: Plan[] }>('/improvement-plans'),
]);
```

📎 کد: `apps/web/src/components/EvaluationForm.tsx`

```tsx
'use client';
// ذخیره پیش‌نویس (PUT) پیش از ارسال نهایی؛ ارسال نهایی پس از موفقیت، صفحه را تازه می‌کند
await apiClient('PUT', `/evaluations/${assignmentId}/responses`, { answers: payload() });
await apiClient('POST', `/evaluations/${assignmentId}/submit`);
router.refresh();
```

```tsx
// انواع پاسخ: طیف/تک‌گزینه‌ای (رادیو)، چندگزینه‌ای (چک‌باکس)، عددی، درصد، متن — همه با گزینه «مصداق ندارد»
if (answerType === 'rating_5' || answerType === 'single_choice') {
  return <fieldset disabled={disabled || na}>{options.map(/* رادیوهای قابل‌دسترس‌پذیری */)}<NaToggle/></fieldset>;
}
```

> ⚠️ کامپوننت‌های RTL باید با `DirectionProvider dir="rtl"` بسته شوند تا پرimیتیوهای Radix هم راست‌چین شوند.
> 💡 `faDigits`/`formatJalali` در `lib/format.ts` همه اعداد و تاریخ‌ها را یکدست نشان می‌دهند.

---

## ۴.۱۴ موتور امتیازدهی و ارزیاب فرمول (هسته خالص)

**🎯 مسئولیت:** محاسبه قطعی امتیاز با `decimal.js`؛ پشتیبانی از **شاخص محاسباتی** و تمایز صفر/بی‌پاسخ/N/A.

📎 کد: `packages/shared/src/scoring.ts`

```ts
// فرمول‌های مستندشده (بدون I/O؛ فرانت هرگز مرجع نیست)
// SectionScore(e,c) = Σ(AnswerScore × QuestionWeight) / Σ(QuestionWeight)
// FormScore(e)      = Σ(SectionScore × SectionWeight) / Σ(SectionWeight)
// FinalScore        = Σ(FormScore × EvaluatorWeight)   / Σ(EvaluatorWeight)
export function computeFinalScore(submissions, sections, policy = DEFAULT_SCORING_POLICY) {
  // وزن ارزیاب غایب هرگز بی‌صدا بازتوزیع نمی‌شود؛ فقط شامل‌ها در میانگین می‌آیند
  // و نتیجه با complete=false و هشدار برگردانده می‌شود
}
```

📎 کد: `packages/shared/src/formula.ts`

```ts
// ارزیاب امن فرمول (بدون eval): عدد، + - * /، پرانتز و شناسه‌ها
export function evaluateFormula(expression: string, vars: Record<string, number>): number {
  const value = new Parser(tokenize(expression.trim()), vars).parse();
  if (!Number.isFinite(value)) throw new Error('نتیجه فرمول عدد معتبر نیست.');
  return value;
}
// مثال: 'quality * 0.6 + teamwork * 0.4'  روی امتیاز نرمال‌شده پرسش‌های دیگر
```

**تست نمونه:** `tests/unit/scoring.test.ts` (۱۵ تست) و `tests/unit/formula.test.ts` (۷ تست) — شامل حالت‌های مرزی، بی‌پاسخ، N/A، گردکردن، تقسیم بر صفر و متغیر ناشناخته.

> ⚠️ در فرمول محاسباتی، متغیرها **شناسه پایدار پرسش** و مقدارشان **امتیاز نرمال‌شده ۰–۱۰۰** است.
> 💡 فرمولِ نامعتبر باعث شکست کل محاسبه نمی‌شود؛ آن پرسش بی‌پاسخ می‌ماند.

---

## ۴.۱۵ ورکر و صف کارها

**🎯 مسئولیت:** اجرای کارهای پس‌زمینه (خروجی گزارش، یادآوری‌ها) با قابلیت تلاش مجدد و dead-letter.

📎 کد: `apps/api/src/lib/jobs.ts`

```ts
// قفل‌گیری امن با SKIP LOCKED → چند ورکر هم‌زمان یک کار را نمی‌گیرند
const rows = await tx.$queryRaw`SELECT id FROM jobs WHERE status='pending' AND run_at <= now()
                                ORDER BY run_at ASC LIMIT ${limit} FOR UPDATE SKIP LOCKED`;
// پسنشست نمایی در خطا؛ پس از maxAttempts → status='dead'
```

> 🔧 `npm run worker` ورکر را اجرا می‌کند؛ جایگزین: زمان‌بند روی `POST /jobs/run` با `CRON_SECRET`.

---

## ۴.۱۶ بسته‌های مشترک

| بسته | محتوا | نکته |
|---|---|---|
| `shared/permissions.ts` | فهرست ۷۳ دسترسی با دسته و توضیح فارسی | سرور فقط نام‌های همین فهرست را می‌پذیرد |
| `shared/roles.ts` | ۵ نقش پیش‌فرض (+ نقش محافظت‌شده) | مدیر ارشد همه دسترسی‌ها را دارد |
| `shared/enums.ts` | وضعیت‌ها + برچسب و رنگ فارسی | نمایش یکدست وضعیت‌ها |
| `shared/workflow.ts` | ماشین وضعیت ارزیابی/دوره | گذارهای مجاز، سمت سرور اعمال می‌شود |
| `validation/*` | اسکیماهای Zod | همان قاعده در سرور و کلاینت |
| `ui/index.ts` | `cn` + توکن‌ها | یکسان‌سازی ظاهر |

---

## 🧾 خلاصه فصل

هر ماژول یک قلمرو روشن دارد؛ منطق حساس (امتیاز، فرمول، گذار وضعیت) در «هسته خالص» نشسته و در سرور اعمال می‌شود، و فرانت‌اند صرفاً نمایش و تعامل است. فصل بعد تمام اندپوینت‌ها را با امضا و نمونه فراخوانی فهرست می‌کند.

⬅️ [فصل ۳ — معماری](./03-architecture.md) · ➡️ [فصل ۵ — مستندات رابط‌ها](./05-api.md)
