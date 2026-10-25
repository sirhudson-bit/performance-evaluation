# فصل ۶ — پیکربندی

> **یک‌خطی:** پیکربندی از دو جا می‌آید — متغیرهای محیطی `.env` (با اعتبارسنجی Zod در بوت) و «تنظیمات درون‌برنامه‌ای» که مدیر سامانه از پنل تغییر می‌دهد.

📍 بازگشت به [فهرست مطالب](./README.md)

---

## ۶.۱ جدول کامل متغیرهای محیطی

📎 منبع: `apps/api/src/config.ts` (schema با Zod)

| متغیر | پیش‌فرض | الزامی | توضیح |
|---|---|---|---|
| `NODE_ENV` | `development` | ➖ | `development` \| `test` \| `production` |
| `DATABASE_URL` | — | ✅ | رشته اتصال PostgreSQL |
| `APP_KEY` | — | ✅ | حداقل ۱۶ نویسه؛ امضای نشست/CSRF و رمزنگاری کلید AI |
| `CRON_SECRET` | — | ➖ (۱۲+ نویسه؛ لازم برای صف) | توکن درین صف کارها |
| `APP_URL` | `http://localhost:3000` | ➖ | مبدأ عمومی (لینک‌ها، CORS) |
| `APP_NAME` | `سامانه ارزیابی عملکرد` | ➖ | نام نمایشی پیش‌فرض |
| `API_PORT` | `4000` | ➖ | پورت سرویس API |
| `API_URL` | `http://127.0.0.1:4000` | ➖ | مقصد پروکسی سرور Next |
| `SESSION_COOKIE_NAME` | `pe_session` | ➖ | نام کوکی نشست |
| `SESSION_TTL_SECONDS` | `43200` | ➖ | عمر نشست (۱۲ ساعت، **لغزان**) |
| `SMTP_HOST` | — | ➖ | میزبان SMTP |
| `SMTP_PORT` | — | ➖ | پورت SMTP |
| `SMTP_SECURE` | — | ➖ | `true` برای TLS |
| `SMTP_USER` / `SMTP_PASSWORD` | — | ➖ | اعتبارنامه SMTP |
| `SMTP_FROM` | — | ➖ | فرستنده؛ **با `SMTP_HOST` لازم است** تا `configured` شود |
| `STORAGE_DIR` | `<repo>/storage` | ➖ | محل فایل‌های خروجی گزارش |
| `SEED_DEMO_DATA` | — | ➖ | درج داده نمونه در seed |

> 🔧 **بارگذاری `.env`:** `config.ts` ابتدا `.env` ریشه مخزن را می‌خواند و با `override: true` مقادیر آن را **مطلق** می‌کند. اگر `.env` نبود، متغیرهای محیطی واقعی سیستم مرجع‌اند (مسیر استقرار تولید).
> ⚠️ اگر `DATABASE_URL` یا `APP_KEY` نباشد، فرآیند **در بوت با خطای واضح** متوقف می‌شود (fail-fast)، نه در میانه درخواست.

```ts
// apps/api/src/config.ts — شکست سریع با پیام روشن
const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required.'),
  APP_KEY: z.string().min(16, 'APP_KEY must be at least 16 characters.'),
  // …
});
const parsed = schema.parse(process.env);   // نامعتبر → خطا در بوت
```

---

## ۶.۲ تنظیمات درون‌برنامه‌ای (Settings)

این‌ها در جدول `organization_settings` ذخیره می‌شوند و **بدون restart** اثر می‌کنند:

| کلید | اثر |
|---|---|
| `organization_display_name` | نام سازمان در هدر/ورود (پس از ذخیره، `router.refresh()`) |
| `theme` / تم پیش‌فرض | حالت روشن/تاریک پیش‌فرض |
| تنظیمات PWA | نام، رنگ، آیکون → `/public/config` و مانیفست پویا |
| سیاست محرمانگی پیش‌فرض دوره | `named` / `confidential` / `anonymous` |
| سیاست امتیازدهی و جبران خدمات | انتخاب نسخه فعال |

```bash
# خواندن/نوشتن تنظیمات (فقط با دسترسی مناسب)
curl -s http://localhost:3000/api/v1/admin/settings -b "pe_session=$SESSION"
curl -s -X PUT http://localhost:3000/api/v1/admin/settings \
  -H 'content-type: application/json' -H "x-csrf-token: $CSRF" -b "pe_session=$SESSION" \
  -d '{"organization_display_name":"شرکت نمونه"}'
```

> 💡 فایل‌های کانفیگ مستقل نداریم؛ **`.env` + جدول تنظیمات** جای فایل‌های JSON/YAML را می‌گیرند تا یک منبع حقیقت واحد بماند.

---

## ۶.۳ تفاوت تنظیمات در محیط‌ها

| موضوع | توسعه | تست | تولید |
|---|---|---|---|
| `NODE_ENV` | `development` | `test` | `production` |
| کوکی نشست | `secure: false` | `false` | `secure: true` (فقط HTTPS) |
| منبع پیکربندی | `.env` ریشه (override) | `.env` | متغیرهای محیطی واقعی |
| Service Worker/PWA | غیرفعال (خودلغو) | غیرفعال | فعال |
| SMTP | معمولاً بدون SMTP (لاگ) | mock | SMTP واقعی |
| صف | دستی `POST /jobs/run` | در تست | ورکر/زمان‌بند |

> ⚠️ در تولید **هیچ `.env` نسپارید**؛ از متغیرهای محیطی سیستم استفاده کنید و `APP_KEY` را از یک مدیر راز (secret manager) تزریق کنید.

---

## 🧾 خلاصه فصل

پیکربندی ترکیبی از `.env` اعتبارسنجی‌شده در بوت و تنظیمات دیتابیسی قابل‌ویرایش از پنل است؛ فصل بعد مسیرهای استقرار، پایش و پشتیبان‌گیری را می‌گوید.

⬅️ [فصل ۵ — API](./05-api.md) · ➡️ [فصل ۷ — استقرار](./07-deployment.md)
