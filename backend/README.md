# بک‌اند سامانه مشاهیر آینده

API-only روی Laravel 13 + PostgreSQL. فرانت جداگانه در `../frontend` ساخته و به‌صورت استاتیک سرو می‌شود؛ این اپ SPA سرو نمی‌کند.

- ورود فقط با OTP؛ توکن Sanctum به‌صورت Bearer در `localStorage` فرانت نگهداری می‌شود (کوکی/CSRF ندارد).
- همه‌ی مسیرها زیر `/api/v1` هستند؛ سلامت سرویس: `GET /up`.
- کنترل دسترسی سمت سرور از یک فایل واحد: `app/Support/Rbac/permission_matrix.php` → Seeder و تست‌ها از همان می‌خوانند.
- `school_id` روی مدل‌های مدرسه‌ای با گلوبال اسکوپ `BelongsToSchool` اعمال می‌شود؛ خارج از محدوده = ۴۰۴.
- زمان‌ها UTC ذخیره می‌شوند (نمایش شمسی سمت فرانت).

## پیش‌نیازها

- PHP 8.3+ (CI با 8.4 اجرا می‌شود) و اکستنشن‌های `pdo_pgsql`, `mbstring`, `intl`, `bcmath`, `zip`, `fileinfo`, `xml`, `curl`
- Composer 2
- PostgreSQL 16+ (لوکال/تست روی پورت 5433)
- ردیس اختیاری (در `.env.example` پیش‌فرض است؛ بدون آن `file`/`sync` کافی است)

## راه‌اندازی محلی

```bash
composer install
cp .env.example .env
php artisan key:generate          # فقط یک‌بار؛ بعداً عوض نکن (به PhoneHash و فیلدهای encrypted وابسته است)

# اگر ردیس نداری:
# SESSION_DRIVER=file
# CACHE_STORE=file
# QUEUE_CONNECTION=sync

php artisan migrate:fresh --seed --force
php artisan serve --port=8000
```

`db:seed` دو Seeder را صدا می‌زند: `PermissionSeeder` (RBAC از ماتریس) و `LocalDemoSeeder` که فقط وقتی `APP_ENV=local` باشد داده‌ی دمو می‌سازد.

حساب‌های دمو و شماره‌ها در README ریشه آمده‌اند. در حالت dev، کد OTP در `storage/logs/laravel.log` نوشته می‌شود (`SMS_DRIVER=log`).

## تست‌ها

`phpunit.xml` به دیتابیس `mashahir_test` روی `127.0.0.1:5433` وصل می‌شود (کاربر/رمز `mashahir`):

```sql
CREATE USER mashahir WITH PASSWORD 'mashahir';
CREATE DATABASE mashahir_test OWNER mashahir;
```

```bash
php artisan test
```

حدود ۲۰۸ متد تست در `tests/Unit` و `tests/Feature` (ماتریس مجوزها، جداسازی ولی‌ها، append-only، جریان‌های کامل، فایل منیجر، مدارس/سرویس/مشاوره/انجمن).

## ساختار

```
app/
  Http/Middleware/SetAuthContext.php   # نقش فعال + SchoolContext + PermissionRegistrar
  Modules/<Domain>/                    # Academic, Admissions, Assignments, Attendance, ...
  Support/Rbac/                        # ماتریس مجوزها، RbacSync، Registrar
  Support/Sms/                         # SmsManager + درایورها
  Support/SchoolContext.php            # اسکوپ مدرسه برای هر درخواست
config/sms.php                         # درایور پیامک و سیاست OTP
routes/api.php                         # کل قرارداد API
database/seeders/                      # RBAC + دمو (فقط local)
```

دستورهای مرتبط:

```bash
php artisan rbac:sync                  # همگام‌سازی idempotent نقش/مجوز از ماتریس (نقش‌های سفارشی مدارس دست‌نخورده)
php artisan matrix:export              # تولید مجدد docs/permission-matrix.md
```

## دپلوی (پروداکشن)

### ۱) آماده‌سازی سرور

```bash
sudo apt install nginx php8.4-fpm php8.4-pgsql php8.4-mbstring php8.4-intl \
  php8.4-bcmath php8.4-zip php8.4-xml php8.4-curl php8.4-fileinfo postgresql git unzip

sudo -u postgres psql -c "CREATE USER mashahir WITH PASSWORD '***';"
sudo -u postgres psql -c "CREATE DATABASE mashahir OWNER mashahir;"
```

در PHP-FPM (`/etc/php/8.4/fpm/php.ini`) سقف آپلود را بالاتر از سقف ۱۰MB فایل‌ها بگذار، وگرنه آپلود قبل از رسیدن به لاراول رد می‌شود:

```ini
upload_max_filesize = 12M
post_max_size = 13M
```

### ۲) کد و پیکربندی

```bash
sudo mkdir -p /var/www/mashahir && cd /var/www/mashahir
# ریپو خصوصی است: SSH با deploy key (فقط‌خواندنی)، نه HTTPS بدون توکن.
sudo -u deploy git clone git@github.com:hoseinrza/mashahir.git .

cd backend
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate           # یک‌بار؛ از .env بکاپ بگیر
# .env را طبق جدول پایین تنظیم کن
php artisan migrate --force        # هرگز migrate:fresh در پروداکشن
php artisan db:seed --force        # فقط RBAC؛ LocalDemoSeeder بیرون از local کاری نمی‌کند
php artisan optimize
sudo chown -R www-data:www-data storage bootstrap/cache
```

**دسترسی به ریپوی خصوصی (deploy key):** یک‌بار روی سرور، به‌عنوان کاربر `deploy`:

```bash
sudo -u deploy ssh-keygen -t ed25519 -N "" -C mashahir-deploy -f /home/deploy/.ssh/mashahir_github
sudo cat /home/deploy/.ssh/mashahir_github.pub
```
کلید را در `https://github.com/hoseinrza/mashahir/settings/keys` با گزینه‌ی read-only اضافه کن، بعد:

```bash
sudo -u deploy tee -a /home/deploy/.ssh/config >/dev/null <<'EOF'
Host github.com
  IdentityFile ~/.ssh/mashahir_github
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
EOF
sudo chmod 600 /home/deploy/.ssh/config
sudo -u deploy git ls-remote --exit-code git@github.com:hoseinrza/mashahir.git >/dev/null && echo OK
```

**اگر `Permission denied (publickey)` بود:** کلید اضافه نشده یا روی ریپوی دیگری است.

**اگر `Connection to github.com closed by remote host` یا `expected flush after ref listing` بود:** پورت ۲۲ در مسیر شبکه بسته/دست‌کاری می‌شود. گیت‌هاب همان SSH را روی ۴۴۳ هم سرو می‌کند:

```bash
sudo -u deploy tee /home/deploy/.ssh/config >/dev/null <<'EOF'
Host github.com
  HostName ssh.github.com
  Port 443
  IdentityFile ~/.ssh/mashahir_github
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
EOF
sudo chmod 600 /home/deploy/.ssh/config
sudo -u deploy git ls-remote --exit-code git@github.com:hoseinrza/mashahir.git >/dev/null && echo OK
```

اگر هر دو پورت بسته بودند، از ماشین خودت باندل بساز و بفرست (کلید فقط برای `git pull`های بعدی لازم می‌شود):

```powershell
git bundle create mashahir.bundle --all
scp mashahir.bundle root@<server>:/root/
```

```bash
sudo -u deploy git clone /root/mashahir.bundle /var/www/mashahir
sudo -u deploy git -C /var/www/mashahir remote set-url origin git@github.com:hoseinrza/mashahir.git
```

### ۳) متغیرهای محیطی پروداکشن

| کلید | مقدار |
|---|---|
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_URL` | `https://<domain>` |
| `LOG_LEVEL` | `error` (یا `warning`) |
| `DB_*` | اتصال واقعی PostgreSQL |
| `SESSION_DRIVER` | `file` (یا `redis`/`database`) |
| `CACHE_STORE` | `file` (یا `redis`) |
| `QUEUE_CONNECTION` | `sync` (هیچ Job واقعی در کد نیست) |
| `FILESYSTEM_DISK` | `local` (فایل‌ها در `storage/app/private`) |
| `SMS_DRIVER` | `log` — تا درایور واقعی اضافه نشده |
| `OTP_TTL_MINUTES` | پیش‌فرض ۵ |
| `SKYROOM_DRIVER` | `skyroom` + `SKYROOM_API_KEY` برای سرویس واقعی، `fake` برای دمو |

`SESSION_DRIVER=redis` در `.env.example` آمده؛ اگر ردیس نداری حتماً `file` بگذار، وگرنه هر درخواست ۵۰۰ می‌دهد.

### ۴) Nginx

فرانت استاتیک روی ریشه و API روی `/api` (جزئیات فرانت در `../frontend/README.md`):

```nginx
server {
    listen 443 ssl http2;
    server_name example.ir;

    root /var/www/mashahir/frontend/dist;
    index index.html;
    client_max_body_size 12m;

    location ^~ /api {
        root /var/www/mashahir/backend/public;
        try_files $uri /index.php?$query_string;
    }

    location = /up {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME /var/www/mashahir/backend/public/index.php;
        fastcgi_param SCRIPT_NAME /index.php;
        fastcgi_pass unix:/run/php/php8.4-fpm.sock;
    }

    location = /index.php {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME /var/www/mashahir/backend/public/index.php;
        fastcgi_param SCRIPT_NAME /index.php;
        fastcgi_pass unix:/run/php/php8.4-fpm.sock;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

اگر API را روی زیردامنه‌ی جدا می‌بری (`api.example.ir`)، ریشه‌ی سایت همان `backend/public` می‌شود، `VITE_API_URL` باید absolute باشد، و `config/cors.php` را publish و `allowed_origins` را محدود کن (پیش‌فرض فریم‌ورک `*` است).

بلوک TLS را با `sudo certbot --nginx -d example.ir` بگیر (خودش `ssl_certificate` را اضافه می‌کند)، بعد `sudo nginx -t && sudo systemctl reload nginx`. تغییر `.env` یعنی `php artisan optimize:clear && php artisan optimize`.

### ۵) اولین کاربر

ورود فقط OTP است و کاربر باید از قبل وجود داشته باشد؛ seed پروداکشن کاربر نمی‌سازد. یک‌بار با tinker بساز (بعد از `migrate` و `db:seed`):

```bash
php artisan tinker
```

```php
$school = App\Modules\School\Models\School::create([
    'name' => 'مشاهیر آینده',
    'level' => 'high',
    'grading_type' => 'numeric',
    'student_has_account' => true,
    'timezone' => 'Asia/Tehran',
    'is_active' => true,
]);

$phone = '0912xxxxxxx';
$user = App\Modules\Identity\Models\User::create([
    'first_name' => '...',
    'last_name' => '...',
    'phone' => $phone,
    'phone_hash' => App\Support\PhoneHash::of($phone),
    'status' => 'active',
]);

App\Modules\Identity\Models\UserRole::create([
    'user_id' => $user->id,
    'role_id' => App\Modules\Identity\Models\Role::whereNull('school_id')->where('key', 'platform_admin')->value('id'),
    'school_id' => $school->id,   // SchoolContext::set(int) است و null را قبول نمی‌کند
    'scope_type' => 'school',
    'scope_id' => null,
    'starts_on' => now()->toDateString(),
]);
```

بقیه‌ی کاربران و مدارس از داخل پنل ساخته می‌شوند.

### ۶) پس از دپلوی

```bash
curl -I https://<domain>/up                                   # 200
curl -X POST https://<domain>/api/v1/auth/otp/request \
  -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -d '{"phone":"0912xxxxxxx"}'
# تا درایور SMS اضافه نشده، کد در storage/logs/laravel.log است
```

### عملیات

- **بکاپ**: `pg_dump` + کل `backend/storage/app/private` (پیوست‌ها) + `.env`. دیتابیس تنها جای داده‌های ساختاری است؛ فایل‌ها جای دیگری‌اند.
- **بعد از تغییر ماتریس مجوزها**: `php artisan rbac:sync` (نیازی به reseed کامل نیست).
- **دیباگ**: `php artisan optimize:clear` بعد `php artisan about`؛ لاگ در `storage/logs/laravel.log`.
- **Queue worker / cron**: لازم نیست. هیچ `ShouldQueue` و هیچ `schedule()` وجود ندارد؛ `NotificationService::dispatchQueued()` از یک endpoint (دکمه‌ی ارسال) صدا زده می‌شود، نه worker.
- **`storage:link`**: لازم نیست؛ دیسک پیش‌فرض `local` و خصوصی است و فایل‌ها با کنترل دسترسی از کنترلر stream می‌شوند.

## محدودیت‌های شناخته‌شده

1. **درایور پیامک**: `app/Support/Sms/SmsManager.php` فقط `log` و `array` را می‌شناسد. هر مقدار دیگری در `SMS_DRIVER` استثنا می‌دهد و کاربر واقعی کد OTP نمی‌گیرد. تا انتخاب پنل پیامکی و پیاده‌سازی درایور، فقط برای دمو/تست مناسب است.
2. **`APP_KEY`**: تغییر آن همه‌ی `phone_hash`ها و شماره‌های `encrypted` را از کار می‌اندازد. بکاپ `.env` بخشی از بکاپ است.
3. **CORS**: فایل `config/cors.php` در ریپو نیست؛ پیش‌فرض فریم‌ورک `allowed_origins = ['*']` است. با معماری تک‌دامنه اهمیتی ندارد؛ با دامنه‌ی جدا باید محدود شود.
