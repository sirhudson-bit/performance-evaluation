# فصل ۲ — پیش‌نیازها و نصب

> **یک‌خطی:** برای اجرای پروژه فقط به Node.js و PostgreSQL نیاز دارید؛ یک فرمان (`npm run setup`) همه‌چیز را نصب و آماده می‌کند و `npm run dev` خودش پایگاه‌داده و کلاینت Prisma را هم بالا می‌آورد.

📍 بازگشت به [فهرست مطالب](./README.md)

---

## ۲.۱ وابستگی‌ها و نسخه‌ها

**حداقل‌های محیطی**

| نیازمندی | حداقل | نسخه‌ای که پروژه با آن توسعه یافته | توضیح |
|---|---|---|---|
| Node.js | ۲۰ | **۲۴.۱۹.۰** | `engines.node >= 20` در `package.json` |
| npm | ۹ | **۱۱.۱۷.۰** | به‌دلیل «workspaces» و قابلیت `allow-scripts` |
| PostgreSQL | ۱۴ | **۱۶.۱۵** | پایگاه‌داده اصلی؛ در توسعه یک کلاستر محلی روی پورت **۵۵۴۳۳** |
| سیستم‌عامل | Windows / macOS / Linux | Windows 11 | اسکریپت‌ها cross-platform هستند |

**وابستگی‌های اصلی (نسخه‌های واقعی نصب‌شده)**

| بسته | نسخه | نقش |
|---|---|---|
| `next` | ۱۵.۵.۲۷ | فریم‌ورک وب (App Router) |
| `react` / `react-dom` | ۱۹.۳.۰ | کتابخانه UI |
| `tailwindcss` | ۳.۴.x | استایل و توکن‌های طراحی |
| `prisma` / `@prisma/client` | ۶.۱۹.۳ | ORM و مهاجرت‌ها |
| `express` | ۴.۲۲.۳ | سرور API |
| `tsx` | ۴.۱۹.۲ | اجرای مستقیم TypeScript (API و ورکر) |
| `vitest` | ۲.۱.۹ | تست واحد |
| `zod` | ۳.۲۵.۷۶ | اعتبارسنجی (مشترک سرور و کلاینت) |
| `decimal.js` | ۱۰.۶.۰ | حساب دقیق امتیازها (بدون خطای شناور) |
| `bcryptjs` | ۳.۰.۳ | درهم‌سازی رمز عبور |
| `exceljs` | ۴.۴.۰ | ورود/خروجی اکسل |
| `jalaali-js` | ۲.۰.۱ | تبدیل تاریخ شمسی |
| `recharts` | ۲.۱۵.۴ | نمودارها |
| `lucide-react` | ۰.۴۶۹.۰ | آیکون‌ها |
| `@fontsource-variable/vazirmatn` | ۵.۳.۰ | قلم فارسی (SIL OFL 1.1) |
| `helmet` / `cors` / `express-rate-limit` / `pino` | ۸.۳.۰ / ۲.۸.۶ / ۷.۵.۱ / ۹.۱۴.۰ | امنیت هدرها، CORS، محدودسازی نرخ، لاگ ساختاریافته |

> 🔧 **نکته درباره «allow-scripts»:** npm جدید نصب اسکریپت‌های پس‌از‌نصب را پیش‌فرض مسدود می‌کند. این پروژه `allowScripts` را در `package.json` ثبت کرده است تا موتورهای Prisma و `esbuild` درست نصب شوند.

---

## ۲.۲ نصب گام‌به‌گام

### 🚀 مسیر سریع (توصیه‌شده)

```bash
# ۱) نصب وابستگی‌ها + تولید خودکار کلاینت Prisma
npm install --include=dev

# ۲) آماده‌سازی پایگاه‌داده: تولید کلاینت، اجرای مهاجرت‌ها، درج داده نمونه
npm run setup

# ۳) اجرا (خودش PostgreSQL را هم بالا می‌آورد)
npm run dev
```

سپس <http://localhost:3000> را باز کنید.

> ⚠️ **تله `NODE_ENV`:** اگر این ماشین `NODE_ENV=production` را به‌صورت سراسری صادر کند، `npm install` بدون `--include=dev` وابستگی‌های توسعه را نصب **نمی‌کند** و `next dev` رفتار تولیدی می‌گیرد. همیشه `--include=dev` بزنید؛ اسکریپت `apps/web/scripts/dev.cjs` هم `NODE_ENV=development` را اجبار می‌کند.

### ۲.۲.۱ فرمان `npm run dev` چه می‌کند؟

اسکریپت `scripts/dev.cjs` **خودترمیم** است و قبل از اجرا:

```js
// scripts/dev.cjs — خلاصه منطق (با توضیح فارسی)
// ۱) اگر node_modules نبود، خطا می‌دهد و راه حل را می‌گوید
// ۲) اگر .env نبود، از .env.example می‌سازد
// ۳) اگر کلاینت Prisma تولید نشده بود →  prisma generate
// ۴) اگر PostgreSQL روی پورت DATABASE_URL بالا نبود →  pg_ctl start (و انتظار برای آماده‌شدن)
// ۵)  prisma migrate deploy   (بی‌اثر اگر مهاجرتی نمانده باشد)
// ۶) اجرای همزمان api (۴۰۰۰) و web (۳۰۰۰)
const clientMarker = path.join(ROOT, 'node_modules', '.prisma', 'client', 'index.js');
if (!fs.existsSync(clientMarker)) run(prismaBin, ['generate']);   // رفع «Prisma fails to load»
```

### ۲.۲.۲ مسیر دستی (اگر می‌خواهید هر گام را خودتان بزنید)

```bash
# ۱) وابستگی‌ها
npm install --include=dev

# ۲) پیکربندی محیط
cp .env.example .env          # سپس APP_KEY و DATABASE_URL را پر کنید

# ۳) تولید کلاینت Prisma
npx prisma generate

# ۴) ساخت/به‌روزرسانی جداول
npx prisma migrate deploy     # یا: npx prisma migrate dev   (در حال توسعه)

# ۵) درج داده نمونه (نقش‌ها، دسترسی‌ها، مدیر، سازمان نمونه، فرم منتشرشده)
npm run db:seed

# ۶) اجرا
npm run dev:servers           # فقط سرورها، بدون بررسی/راه‌اندازی پایگاه‌داده
```

**ساخت `APP_KEY` (کلید ۳۲ بایتی):**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### ۲.۲.۳ راه‌اندازی دستی پایگاه‌داده (در صورت نیاز)

```bash
# شروع کلاستر محلی پروژه (داده‌ها در ./.pgdata)
"C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe" -D ".pgdata" -o "-p 55433" -l ".pgdata\server.log" start

# بررسی آماده‌بودن
"C:\Program Files\PostgreSQL\16\bin\pg_isready.exe" -h 127.0.0.1 -p 55433
```

> 💡 نیازی به Docker نیست. فایل `docker-compose.yml` فقط یک گزینه اختیاری برای کسانی است که کانتینر ترجیح می‌دهند.

---

## ۲.۳ تنظیمات اولیه و متغیرهای محیطی

فایل `.env` در ریشه پروژه قرار می‌گیرد (و در `.gitignore` است). فهرست کامل در [فصل ۶ — پیکربندی](./06-config.md) آمده؛ حداقل‌های لازم:

| متغیر | الزامی | نمونه | توضیح |
|---|---|---|---|
| `DATABASE_URL` | ✅ | `postgresql://postgres:***@127.0.0.1:55433/performance_evaluation?schema=public` | رشته اتصال PostgreSQL |
| `APP_KEY` | ✅ | ۳۲ بایت base64 | امضای نشست/CSRF و رمزنگاری کلید سرویس‌های AI |
| `CRON_SECRET` | ✅ (برای صف) | رشته تصادفی | توکن درین صف کارها |
| `APP_URL` | ➖ | `http://localhost:3000` | مبدأ عمومی (لینک‌ها، CORS) |
| `API_URL` | ➖ | `http://127.0.0.1:4000` | مقصد پروکسی سرور Next |
| `API_PORT` | ➖ | `4000` | پورت سرویس API |
| `SESSION_COOKIE_NAME` | ➖ | `pe_session` | نام کوکی نشست |
| `SESSION_TTL_SECONDS` | ➖ | `43200` | عمر نشست (۱۲ ساعت، لغزان) |
| `SEED_DEMO_DATA` | ➖ | `true` | درج داده نمونه در seed |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | ➖ | — | حساب مدیر اولیه در seed (اگر رمز ندهید، تصادفی ساخته و یک‌بار چاپ می‌شود) |
| `SMTP_*` | ➖ | — | اختیاری؛ اگر تنظیم نشود ایمیل فقط در لاگ ثبت می‌شود |

> ⚠️ هرگز `.env` واقعی را commit نکنید. `.env.example` فقط شامل نام‌ها و مقادیر جای‌گزین است.

---

## ۲.۴ اجرای اولین تست سلامت

### گام ۱ — بررسی سلامت سرویس API

```bash
curl http://127.0.0.1:4000/api/v1/health
# خروجی موفق:
# {"data":{"status":"ok","database":true,"time":"…","version":"0.1.0"}}
```

اگر `"database": false` دیدید، PostgreSQL بالا نیست (به بخش [۸ — عیب‌یابی](./08-troubleshooting.md) مراجعه کنید).

### گام ۲ — ورود با حساب نمونه

| نقش | ایمیل | رمز |
|---|---|---|
| مدیر سامانه | `admin@performance.test` | `AdminDev!2026` |
| منابع انسانی | `hr@performance.test` | `AdminDev!2026` |
| مدیر مستقیم | `manager@performance.test` | `AdminDev!2026` |
| کارمند | `employee@performance.test` | `AdminDev!2026` |

> 🔧 رمز از `SEED_ADMIN_PASSWORD` می‌آید؛ اگر تنظیم نشده باشد، seed یک رمز تصادفی می‌سازد و **یک‌بار** چاپ می‌کند.

### گام ۳ — اجرای مجموعه بررسی سرتاسری

```bash
npm run verify        # ۷۴ بررسی واقعی روی HTTP
# خروجی: 74/74 checks passed
```

و تست‌های واحد:

```bash
npm test              # ۲۲ تست (موتور امتیازدهی + ارزیاب فرمول)
```

### ✅ چک‌لیست موفقیت نصب

- [ ] `npm run dev` هر دو سرور را بالا آورد (`:3000` و `:4000`).
- [ ] `GET /api/v1/health` مقدار `"status":"ok"` و `"database":true` داد.
- [ ] ورود با `admin@performance.test` موفق بود.
- [ ] `npm test` سبز شد (۲۲/۲۲).
- [ ] `npm run verify` سبز شد (۷۴/۷۴).

---

## 🧾 خلاصه فصل

نصب پروژه سه فرمان است (`npm install --include=dev` → `npm run setup` → `npm run dev`) و نیازی به Docker ندارد؛ `npm run dev` خودش کلاینت Prisma و پایگاه‌داده را هم آماده می‌کند. فصل بعد معماری و لایه‌ها را می‌شکافد.

⬅️ [فصل ۱ — معرفی](./01-intro.md) · ➡️ [فصل ۳ — معماری و ساختار](./03-architecture.md)
