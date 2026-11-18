# فرانت‌اند سامانه مشاهیر آینده

PWA مدرسه، روی Vite + React 19 + TypeScript + Tailwind 4. خروجی `dist/` کاملاً استاتیک است و کنار API لاراول سرو می‌شود.

- احراز هویت: Bearer token در `localStorage` (کلیدهای `mashahir_api_token` و `mashahir_pending_token`) — کوکی و CSRF ندارد.
- آدرس API: `VITE_API_URL` در زمان **build** داخل باندل پخته می‌شود، نه زمان اجرا.
- PWA: پیش‌کش دارایی‌های استاتیک با `autoUpdate`؛ درخواست‌های `/api` هیچ‌وقت cache نمی‌شوند (داده‌ی مدرسه بین حساب‌ها لو نرود).
- اپ موبایل (Capacitor) در همین پوشه: `android/` و `ios/`.

## اجرای محلی

پیش‌نیاز: Node.js 22+ (همان نسخه‌ی CI) و بک‌اند روی `127.0.0.1:8000`.

```bash
npm install
npm run dev        # http://localhost:3000 — پروکسی /api → BACKEND_URL (پیش‌فرض 8000)
```

`BACKEND_URL` فقط dev-server را جابه‌جا می‌کند (`vite.config.ts`).

## متغیرهای محیطی

| متغیر | فایل | کاربرد |
|---|---|---|
| `VITE_API_URL` | `.env` / `.env.production` | base آدرس API. برای دپلوی تک‌دامنه `/api` بگذار (هم‌مبدأ). مقدار **خالی نده**: کلاینت با `??` می‌خواند و `""` به‌جای fallback استفاده می‌شود |
| `BACKEND_URL` | `.env` | فقط پروکسی dev؛ در build استفاده نمی‌شود |
| `VITE_API_URL` | `.env.mobile` | برای اپ Capacitor باید **absolute** باشد (`https://api.example.ir/api`) چون مبدأ `capacitor://localhost` است |

## اسکریپت‌ها

```bash
npm run dev            # dev server روی 3000
npm run lint           # tsc --noEmit (typecheck؛ همان چیزی که CI اجرا می‌کند)
npm run build          # build وب → dist/
npm run build:mobile   # build با mode=mobile (VITE_API_URL از .env.mobile)
npm run preview        # سرو محلی خروجی build
npm run icons          # تولید آیکون‌های PWA از scripts/mashahir-logo.svg
npm run cap:sync       # build:mobile + cap sync (کپی assets به android/ios)
npm run cap:android    # باز کردن پروژه در Android Studio
npm run cap:ios        # باز کردن پروژه در Xcode
```

قبل از هر تحویل: `npm run lint && npm run build`.

## ساختار

```
src/
  api/            # کلاینت fetch + endpointها (auth, admissions, files, reportCycle, data)
  pages/          # صفحات (React Router)
  components/     # کامپوننت‌های مشترک
  context/        # Contextهای سراسری
  layouts/        # پوسته‌ی اپ
  permissions/    # آینه‌ی سمت کلاینت برای نمایش/پنهان‌سازی UI (منبع حقیقت سرور است)
  theme/          # توکن‌های طراحی و ThemeContext
  utils/          # تاریخ شمسی، اعداد فارسی، برنامه‌ی هفتگی
  types/          # تایپ‌های مشترک
public/           # آیکون‌های PWA و دارایی‌های ثابت
scripts/          # تولید آیکون
```

## دپلوی

خروجی build را روی ریشه‌ی همان دامنه‌ای بگذار که API روی `/api` سرو می‌شود؛ این‌طور `VITE_API_URL` خالی می‌ماند و CORS لازم نیست.

```bash
npm ci
VITE_API_URL=/api npm run build    # خروجی dist/
# dist/ را روی سرور کپی کن (مثلاً /var/www/mashahir/frontend/dist)
```

نمونه‌ی Nginx (کنار کانفیگ API در `../backend/README.md`):

```nginx
root /var/www/mashahir/frontend/dist;
index index.html;

location / {
    try_files $uri $uri/ /index.html;   # SPA fallback برای React Router
}

# سرویس‌ورکر و مانیفست را طولانی cache نکن تا نسخه‌ی جدید سریع برسد
location = /sw.js        { add_header Cache-Control "no-cache"; }
location = /manifest.webmanifest { add_header Cache-Control "no-cache"; }

# فایل‌های هش‌دار Vite را می‌شود برای همیشه cache کرد
location /assets/        { add_header Cache-Control "public, max-age=31536000, immutable"; }
```

نکته‌ها:

- اگر دامنه‌ی API جداست، `VITE_API_URL` را absolute بده و در بک‌اند `config/cors.php` را برای همان origin محدود کن؛ CORS سمت سرور تنظیم می‌شود، کلاینت خودش کاری نمی‌کند.
- تغییر `VITE_API_URL` بدون build مجدد اثر ندارد. در PowerShell (ویندوز): `$env:VITE_API_URL="/api"; npm run build`.
- `dist/` را commit نکن (در `frontend/.gitignore` است)؛ روی سرور/CI بساز.

## اپ موبایل (Capacitor)

`capacitor.config.ts` با `appId = ir.mashahir.school` و `webDir = dist` تنظیم شده؛ پروژه‌های `android/` و `ios/` در ریپو هستند.

```bash
# ۱) دامنه‌ی واقعی API را در .env.mobile بگذار
#    VITE_API_URL="https://api.example.ir/api"
npm run cap:sync
npm run cap:android   # Android Studio → build/sign
npm run cap:ios       # Xcode → archive/sign
```

- اپ موبایل نمی‌تواند مسیر نسبی `/api` را resolve کند؛ absolute الزامی است.
- امضای بیلد (keystore/provisioning) و انتشار در استورها خارج از این ریپو است.
- تغییر API یعنی `build:mobile` + `cap:sync` + release جدید؛ سرویس‌ورکر وب این را برای اپ native انجام نمی‌دهد.
