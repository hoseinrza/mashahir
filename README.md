# سامانه یکپارچه مدرسه مشاهیر آینده — فاز اول (دبیرستان)

بک‌اند: Laravel 12 + PostgreSQL + Redis (پوشه `backend/`) — فرانت: Vite + React + TS + Tailwind 4 (پوشه `frontend/`).

## اجرای محلی

```bash
# ۱) بک‌اند (PHP/Composer از Scoop نصب شده؛ PostgreSQL روی پورت 5433)
cd backend
php artisan serve --port=8000        # Redis هم باید روشن باشد (redis-server)

# ۲) فرانت
cd frontend
npm install
npm run dev                          # http://localhost:3000 (پروکسی /api → 8000)
```

## حساب‌های دمو (بعد از `php artisan migrate:fresh --seed`)

ورود فقط با کد پیامکی است؛ در حالت dev کد در `backend/storage/logs/laravel.log` نوشته می‌شود (درایور log).

| شماره | نقش |
|---|---|
| 09120000001 | مدیر مدرسه |
| 09120000002 | معاون آموزشی |
| 09120000003 | ناظم |
| 09120000004 | معلم |
| 09120000005 | مسئول دفتر |
| 09120000006 | ولی (فریبا) |
| 09120000007 | ولی جداشده (مسعود) — همان فرزند، پرچم‌های مستقل |

## ساختار

- `backend/app/Support/Rbac/permission_matrix.php` — فایل واحد ماتریس مجوزها (Seeder و تست‌ها از آن می‌خوانند)
- `docs/permission-matrix.md` — خروجی انسانی ماتریس | `docs/permission-matrix-review.md` — سلول‌های نیازمند تأیید
- `docs/openapi/core.yaml` — قرارداد API هسته
- `backend/tests` — ۹۱ تست شامل تست ماتریس تولیدی، جداسازی ولی‌های جداشده، append-only لاگ
