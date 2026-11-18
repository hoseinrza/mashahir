#!/usr/bin/env bash
#
# ubuntu-bootstrap.sh — one-shot provisioning for the Mashahir school system.
#
# Target: a fresh Ubuntu 24.04 server, run as root:
#
#   scp scripts/ubuntu-bootstrap.sh root@SERVER:/root/
#   ssh root@SERVER 'bash /root/ubuntu-bootstrap.sh --domain school.example.ir --email admin@example.ir'
#
# What it does:
#   packages -> postgres -> deploy user -> git clone -> .env -> migrate/seed ->
#   first admin -> frontend build -> php-fpm/nginx -> TLS -> backups -> smoke test
#
# The repository is private, so the script prepares a read-only SSH deploy key
# and pauses once so you can add it in GitHub. Re-running is safe: existing
# .env, checkout, nginx site and database are left alone.
#
# Secrets are never echoed. If --db-password is omitted a random one is
# generated and written to /root/mashahir-db-password (mode 600).
#
# If this file travelled through a Windows checkout and bash complains about
# '\r', strip it first:  sed -i 's/\r$//' ubuntu-bootstrap.sh
#
set -Eeuo pipefail

# ---------------------------------------------------------------- configuration
APP_DIR="/var/www/mashahir"
REPO_URL="git@github.com:hoseinrza/mashahir.git"
BRANCH="main"
DEPLOY_USER="deploy"
DEPLOY_GROUP="www-data"
DB_NAME="mashahir"
DB_USER="mashahir"
DB_PASSWORD="${DB_PASSWORD:-}"
DOMAIN="${DOMAIN:-}"
TLS_EMAIL="${TLS_EMAIL:-}"
ADMIN_PHONE="${ADMIN_PHONE:-}"
ADMIN_FIRST="${ADMIN_FIRST:-}"
ADMIN_LAST="${ADMIN_LAST:-}"
WITH_TLS=1
WITH_BACKUPS=1
WITH_UPGRADE=1
GITHUB_SSH_PORT="${GITHUB_SSH_PORT:-auto}"

# ---------------------------------------------------------------------- helpers
if [[ -t 1 ]]; then
    BOLD=$'\033[1m'; BLUE=$'\033[34m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; NC=$'\033[0m'
else
    BOLD=''; BLUE=''; YELLOW=''; RED=''; NC=''
fi

log()  { printf '\n%s==> %s%s\n' "$BLUE" "$*" "$NC"; }
warn() { printf '%s[warn]%s %s\n' "$YELLOW" "$NC" "$*" >&2; }
die()  { printf '%s[fail]%s %s\n' "$RED" "$NC" "$*" >&2; exit 1; }

trap 'printf "\n%s[fail]%s line %s: %s\n" "$RED" "$NC" "$LINENO" "$BASH_COMMAND" >&2' ERR

usage() {
    cat <<'USAGE'
Usage: bash ubuntu-bootstrap.sh --domain DOMAIN [options]

  --domain DOMAIN        public hostname, e.g. school.example.ir (required)
  --email ADDRESS        Let's Encrypt account email; enables HTTPS
  --no-tls               skip certificates entirely
  --repo URL             git remote (default: git@github.com:hoseinrza/mashahir.git)
  --branch NAME          branch to deploy (default: main)
  --github-ssh-port PORT SSH port for GitHub: 22, 443, or auto (default).
                         auto tries 22, then falls back to ssh.github.com:443
  --db-password PASS     PostgreSQL password (prefer the DB_PASSWORD env var,
                         or omit and let the script generate one)
  --admin-phone PHONE    create/ensure the first platform admin
  --admin-first NAME     admin first name (default: مدیر)
  --admin-last NAME      admin last name (default: پلتفرم)
  --no-backups           do not install the nightly backup job
  --no-upgrade           skip apt upgrade (package installs still happen)
  -h, --help             show this help

Environment equivalents: DOMAIN, TLS_EMAIL, DB_PASSWORD, ADMIN_PHONE,
ADMIN_FIRST, ADMIN_LAST, REPO_URL, GITHUB_SSH_PORT.
USAGE
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --domain)       DOMAIN="${2:?--domain needs a value}"; shift 2 ;;
        --email)        TLS_EMAIL="${2:?--email needs a value}"; shift 2 ;;
        --no-tls)       WITH_TLS=0; shift ;;
        --repo)         REPO_URL="${2:?--repo needs a value}"; shift 2 ;;
        --branch)       BRANCH="${2:?--branch needs a value}"; shift 2 ;;
        --github-ssh-port)
                        GITHUB_SSH_PORT="${2:?--github-ssh-port needs a value}"
                        case "$GITHUB_SSH_PORT" in
                            22|443|auto) ;;
                            *) die "--github-ssh-port must be 22, 443 or auto" ;;
                        esac
                        shift 2 ;;
        --db-password)  DB_PASSWORD="${2:?--db-password needs a value}"; shift 2 ;;
        --admin-phone)  ADMIN_PHONE="${2:?--admin-phone needs a value}"; shift 2 ;;
        --admin-first)  ADMIN_FIRST="${2:?--admin-first needs a value}"; shift 2 ;;
        --admin-last)   ADMIN_LAST="${2:?--admin-last needs a value}"; shift 2 ;;
        --no-backups)   WITH_BACKUPS=0; shift ;;
        --no-upgrade)   WITH_UPGRADE=0; shift ;;
        -h|--help)      usage; exit 0 ;;
        *)              die "unknown option: $1 (see --help)" ;;
    esac
done

[[ $EUID -eq 0 ]] || die "run this as root (sudo bash $0 ...)"

if [[ -z "$DOMAIN" && -t 0 ]]; then
    read -r -p "Public domain (e.g. school.example.ir): " DOMAIN
fi
[[ -n "$DOMAIN" ]] || die "--domain is required (or set DOMAIN=...)"
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]] || die "invalid domain: $DOMAIN"

# ------------------------------------------------------------------- pre-flight
log "Pre-flight checks"

[[ -f /etc/os-release ]] || die "cannot read /etc/os-release"
# shellcheck disable=SC1091
. /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || die "this script targets Ubuntu, found '${ID:-unknown}'"
if [[ "${VERSION_ID:-}" != "24.04" ]]; then
    warn "written for Ubuntu 24.04; found ${VERSION_ID:-unknown}. PHP 8.3 packages must exist."
fi

export DEBIAN_FRONTEND=noninteractive

# --------------------------------------------------------------- base packages
log "Updating apt metadata"
apt-get update -y
if [[ "$WITH_UPGRADE" -eq 1 ]]; then
    log "Upgrading installed packages (use --no-upgrade to skip)"
    apt-get -y -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold upgrade
fi

apt-cache show php8.3-fpm >/dev/null 2>&1 \
    || die "php8.3-fpm is not available in this release's repositories"

log "Installing packages"
apt-get install -y --no-install-recommends \
    nginx postgresql postgresql-contrib \
    php8.3-cli php8.3-fpm php8.3-pgsql php8.3-mbstring php8.3-xml \
    php8.3-curl php8.3-bcmath php8.3-zip php8.3-intl \
    composer git unzip curl ca-certificates openssl \
    ufw fail2ban unattended-upgrades certbot python3-certbot-nginx

timedatectl set-timezone UTC
systemctl enable --now postgresql nginx

# Swap keeps a 1-2 GB VPS alive during composer/npm.
if [[ ! -f /swapfile ]]; then
    mem_mb="$(awk '/^MemTotal/{print int($2/1024)}' /proc/meminfo)"
    if (( mem_mb < 3072 )); then
        log "Creating a 2 GB swapfile (RAM: ${mem_mb} MB)"
        fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
        chmod 600 /swapfile
        mkswap /swapfile >/dev/null
        swapon /swapfile
        grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
    fi
fi

# ------------------------------------------------------------------ deploy user
log "Preparing the '$DEPLOY_USER' user"
if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
    adduser --disabled-password --gecos "" --shell /bin/bash "$DEPLOY_USER"
fi
usermod -aG "$DEPLOY_GROUP" "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"

as_deploy() {
    runuser -u "$DEPLOY_USER" -- \
        env HOME="/home/$DEPLOY_USER" \
            PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" "$@"
}

as_deploy_shell() {
    runuser -u "$DEPLOY_USER" -- \
        env HOME="/home/$DEPLOY_USER" \
            PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
            bash -c "$1"
}

as_postgres() {
    runuser -u postgres -- "$@"
}

# -------------------------------------------------------------------- database
log "Preparing PostgreSQL database"
for _ in {1..30}; do
    if as_postgres pg_isready -q; then
        break
    fi
    sleep 1
done
as_postgres pg_isready -q || die "PostgreSQL did not become ready"

if [[ -z "$DB_PASSWORD" ]]; then
    DB_PASSWORD="$(openssl rand -hex 24)"
    printf '%s\n' "$DB_PASSWORD" >/root/mashahir-db-password
    chmod 600 /root/mashahir-db-password
    log "Generated DB password -> /root/mashahir-db-password (not printed)"
fi

ROLE_CREATED=0
if ! as_postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
    as_postgres psql -v ON_ERROR_STOP=1 -v pw="$DB_PASSWORD" \
        -c "CREATE USER $DB_USER WITH PASSWORD :'pw';" >/dev/null
    ROLE_CREATED=1
fi

ENV_FILE="$APP_DIR/backend/.env"
if [[ ! -f "$ENV_FILE" && "$ROLE_CREATED" -eq 0 ]]; then
    # The role predates this run (partial earlier attempt): align it with the
    # password that is about to go into the brand-new .env file.
    as_postgres psql -v ON_ERROR_STOP=1 -v pw="$DB_PASSWORD" \
        -c "ALTER USER $DB_USER WITH PASSWORD :'pw';" >/dev/null
fi

if ! as_postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
    as_postgres createdb -O "$DB_USER" "$DB_NAME"
fi

# --------------------------------------------------------------------- firewall
log "Configuring the firewall"
ufw allow OpenSSH >/dev/null
ssh_port="$(sshd -T 2>/dev/null | awk '/^port /{print $2; exit}' || true)"
if [[ -n "$ssh_port" && "$ssh_port" != "22" ]]; then
    ufw allow "${ssh_port}/tcp" >/dev/null
fi
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null
ufw status | sed -n '1,12p'

# ------------------------------------------------------------------------ clone
log "Fetching the source into $APP_DIR"

# A rejected key and a dropped connection are different problems, so both are
# reported separately. Some networks silently kill SSH on port 22; GitHub
# serves the same protocol on ssh.github.com:443, which is tried second.
git_err_is_connectivity() {
    grep -qiE 'connection (closed|reset|refused|timed out)|closed by remote host|expected flush|broken pipe|kex_exchange_identification|operation timed out' "$1"
}

git_err_is_auth() {
    grep -qi 'permission denied (publickey)' "$1"
}

repo_ls_remote() {
    as_deploy env GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=15" \
        git ls-remote --exit-code "$REPO_URL"
}

# The block is prepended, not appended: ssh keeps the *first* value it sees for
# each keyword, so this also overrides a leftover "Host github.com" stanza from
# an earlier manual attempt. The marker pair makes re-runs idempotent.
write_github_ssh_config() {
    local port="$1" host="github.com" cfg tmp
    if [[ "$port" == "443" ]]; then
        host="ssh.github.com"
    fi
    cfg="/home/$DEPLOY_USER/.ssh/config"
    tmp="$(mktemp)"
    {
        printf '# >>> mashahir github >>>\n'
        printf 'Host github.com\n'
        printf '  HostName %s\n' "$host"
        printf '  Port %s\n' "$port"
        printf '  IdentityFile ~/.ssh/mashahir_github\n'
        printf '  IdentitiesOnly yes\n'
        printf '  StrictHostKeyChecking accept-new\n'
        printf '# <<< mashahir github <<<\n'
    } >"$tmp"
    if [[ -f "$cfg" ]]; then
        sed '/^# >>> mashahir github >>>$/,/^# <<< mashahir github <<<$/d' "$cfg" >>"$tmp"
    fi
    chown "$DEPLOY_USER:$DEPLOY_USER" "$tmp"
    chmod 600 "$tmp"
    mv -f "$tmp" "$cfg"
}

if [[ "$REPO_URL" == *"github.com"* && "$REPO_URL" != https://* ]]; then
    KEY_FILE="/home/$DEPLOY_USER/.ssh/mashahir_github"
    if [[ ! -f "$KEY_FILE" ]]; then
        as_deploy ssh-keygen -t ed25519 -N "" -C "mashahir-deploy" -f "$KEY_FILE" >/dev/null
    fi

    GH_SSH_PORTS=(22 443)
    if [[ "$GITHUB_SSH_PORT" != "auto" ]]; then
        GH_SSH_PORTS=("$GITHUB_SSH_PORT")
    fi

    GIT_ERR="$(mktemp /tmp/mashahir-git-XXXXXX.err)"
    trap 'rm -f "$GIT_ERR"' EXIT

    REPO_ACCESS=0
    KEY_ASKED=0
    GH_SSH_PORT_USED=""

    for port in "${GH_SSH_PORTS[@]}"; do
        write_github_ssh_config "$port"

        if repo_ls_remote 2>"$GIT_ERR"; then
            REPO_ACCESS=1
            GH_SSH_PORT_USED="$port"
            break
        fi

        if git_err_is_connectivity "$GIT_ERR"; then
            warn "SSH to GitHub on port $port failed: $(tail -n 1 "$GIT_ERR")"
            continue
        fi

        if [[ "$KEY_ASKED" -eq 0 ]] && git_err_is_auth "$GIT_ERR"; then
            KEY_ASKED=1
            printf '\nGitHub rejected the deploy key. Add this public key as a\n'
            printf 'READ-ONLY deploy key on this repository:\n'
            printf '  https://github.com/hoseinrza/mashahir/settings/keys\n\n'
            cat "$KEY_FILE.pub"
            printf '\n'
            if [[ -t 0 ]]; then
                read -r -p "Press Enter after adding the key (Ctrl+C aborts)... " _
            else
                die "no TTY to wait for the deploy key; add it and re-run"
            fi

            if repo_ls_remote 2>"$GIT_ERR"; then
                REPO_ACCESS=1
                GH_SSH_PORT_USED="$port"
                break
            fi
            if git_err_is_connectivity "$GIT_ERR"; then
                warn "SSH to GitHub on port $port failed after the key was added: $(tail -n 1 "$GIT_ERR")"
                continue
            fi
        fi

        warn "git could not read $REPO_URL on port $port:"
        sed -n '1,5p' "$GIT_ERR" >&2
    done

    if [[ "$REPO_ACCESS" -ne 1 ]]; then
        printf '\nTried SSH port(s): %s\n' "${GH_SSH_PORTS[*]}"
        printf 'Checklist:\n'
        printf '  - the key above is on %s (read-only)\n' "https://github.com/hoseinrza/mashahir/settings/keys"
        printf '  - outbound TCP to github.com:22 and ssh.github.com:443 is open\n'
        printf '  - no proxy is intercepting SSH (SSH_PROXY, /etc/ssh/ssh_config)\n'
        printf '\nOffline fallback, on your own machine:\n'
        printf '  git bundle create mashahir.bundle --all\n'
        printf '  scp mashahir.bundle root@SERVER:/root/\n'
        printf 'then re-run this script with: --repo /root/mashahir.bundle\n\n'
        die "no SSH access to $REPO_URL"
    fi

    log "GitHub reachable over SSH port $GH_SSH_PORT_USED"
fi

if [[ -d "$APP_DIR/.git" ]]; then
    log "Existing checkout kept (no pull performed)"
elif [[ -e "$APP_DIR" && -n "$(ls -A "$APP_DIR" 2>/dev/null || true)" ]]; then
    die "$APP_DIR is not empty and is not a git checkout; move it away and re-run"
else
    mkdir -p "$APP_DIR"
    chown "$DEPLOY_USER:$DEPLOY_GROUP" "$APP_DIR"
    as_deploy git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

chown -R "$DEPLOY_USER:$DEPLOY_GROUP" "$APP_DIR"
find "$APP_DIR" -type d -exec chmod 755 {} +
find "$APP_DIR" -type f -exec chmod 644 {} +

[[ -f "$APP_DIR/backend/artisan" ]] || die "checkout looks incomplete: backend/artisan missing"

# ------------------------------------------------------------------------- .env
log "Configuring the backend"
if [[ -f "$ENV_FILE" ]]; then
    log "Existing .env kept untouched"
else
    TMP_ENV="$(mktemp)"
    cp "$APP_DIR/backend/.env.example" "$TMP_ENV"

    set_env() {
        local file="$1" key="$2" value="$3" escaped
        escaped="$(printf '%s' "$value" | sed -e 's/[\\&|]/\\&/g')"
        if grep -qE "^[[:space:]]*${key}=" "$file"; then
            sed -i -E "s|^[[:space:]]*${key}=.*|${key}=${escaped}|" "$file"
        else
            printf '%s=%s\n' "$key" "$value" >>"$file"
        fi
    }

    set_env "$TMP_ENV" APP_NAME 'Mashahir School'
    set_env "$TMP_ENV" APP_ENV production
    set_env "$TMP_ENV" APP_DEBUG false
    set_env "$TMP_ENV" APP_URL "https://$DOMAIN"
    set_env "$TMP_ENV" LOG_CHANNEL stack
    set_env "$TMP_ENV" LOG_STACK daily
    set_env "$TMP_ENV" LOG_DAILY_DAYS 14
    set_env "$TMP_ENV" LOG_LEVEL warning
    set_env "$TMP_ENV" DB_CONNECTION pgsql
    set_env "$TMP_ENV" DB_HOST 127.0.0.1
    set_env "$TMP_ENV" DB_PORT 5432
    set_env "$TMP_ENV" DB_DATABASE "$DB_NAME"
    set_env "$TMP_ENV" DB_USERNAME "$DB_USER"
    set_env "$TMP_ENV" DB_PASSWORD "$DB_PASSWORD"
    set_env "$TMP_ENV" SESSION_DRIVER file
    set_env "$TMP_ENV" CACHE_STORE file
    set_env "$TMP_ENV" QUEUE_CONNECTION sync
    set_env "$TMP_ENV" FILESYSTEM_DISK local
    set_env "$TMP_ENV" MAIL_MAILER log
    set_env "$TMP_ENV" MAIL_FROM_ADDRESS "noreply@$DOMAIN"
    set_env "$TMP_ENV" SMS_DRIVER log
    set_env "$TMP_ENV" OTP_TTL_MINUTES 5
    set_env "$TMP_ENV" SKYROOM_DRIVER fake

    install -m 640 -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" "$TMP_ENV" "$ENV_FILE"
    rm -f "$TMP_ENV"
fi

if ! grep -qE '^APP_KEY=base64:' "$ENV_FILE"; then
    as_deploy_shell "cd '$APP_DIR/backend' && php artisan key:generate --force --no-interaction"
fi

as_deploy_shell "cd '$APP_DIR/backend' && COMPOSER_MEMORY_LIMIT=-1 composer install --no-dev --optimize-autoloader --no-interaction"
as_deploy_shell "cd '$APP_DIR/backend' && php artisan migrate --force --no-interaction"
as_deploy_shell "cd '$APP_DIR/backend' && php artisan db:seed --force --no-interaction"
as_deploy_shell "cd '$APP_DIR/backend' && php artisan optimize"

# ---------------------------------------------------------------- first admin
if [[ -n "$ADMIN_PHONE" ]]; then
    log "Creating the first platform admin"
    ADMIN_SCRIPT="$(mktemp /tmp/mashahir-admin-XXXXXX.php)"
    cat >"$ADMIN_SCRIPT" <<'PHP'
<?php

use App\Modules\Identity\Models\Role;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Models\UserRole;
use App\Modules\School\Models\School;
use App\Support\PhoneHash;

$phone = trim((string) getenv('ADMIN_PHONE'));
if ($phone === '') {
    throw new RuntimeException('ADMIN_PHONE is empty');
}

$school = School::query()->first();
if ($school === null) {
    $school = School::query()->create([
        'name' => 'مشاهیر آینده',
        'level' => 'high',
        'grading_type' => 'numeric',
        'student_has_account' => true,
        'timezone' => 'Asia/Tehran',
        'is_active' => true,
    ]);
    echo "school created\n";
}

$user = User::query()->firstOrCreate(
    ['phone_hash' => PhoneHash::of($phone)],
    [
        'first_name' => getenv('ADMIN_FIRST') ?: 'مدیر',
        'last_name' => getenv('ADMIN_LAST') ?: 'پلتفرم',
        'phone' => $phone,
        'status' => 'active',
    ],
);

$roleId = Role::query()->whereNull('school_id')->where('key', 'platform_admin')->value('id');
if ($roleId === null) {
    throw new RuntimeException('platform_admin role is missing; run: php artisan db:seed --force');
}

UserRole::query()->firstOrCreate(
    [
        'user_id' => $user->id,
        'role_id' => $roleId,
        'school_id' => $school->id,
        'scope_type' => 'school',
        'scope_id' => null,
    ],
    ['starts_on' => now()->toDateString()],
);

echo "admin ready: {$phone}\n";
PHP
    chmod 644 "$ADMIN_SCRIPT"
    as_deploy env ADMIN_PHONE="$ADMIN_PHONE" ADMIN_FIRST="$ADMIN_FIRST" ADMIN_LAST="$ADMIN_LAST" \
        bash -c "cd '$APP_DIR/backend' && php artisan tinker --execute='require \"$ADMIN_SCRIPT\";'"
    rm -f "$ADMIN_SCRIPT"
else
    warn "No --admin-phone given: no user exists yet, OTP login cannot work until you create one (see backend/README.md)."
fi

# ------------------------------------------------------------------- frontend
log "Installing Node.js and building the SPA"
node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [[ "$node_major" -lt 22 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi

# VITE_API_URL is baked at build time. "/api" is the same-origin base; do NOT
# pass an empty string — the client uses ?? so "" would become the base itself.
as_deploy_shell "cd '$APP_DIR/frontend' && export VITE_API_URL=/api && npm ci && npm run build"
[[ -f "$APP_DIR/frontend/dist/index.html" ]] || die "frontend build produced no dist/index.html"

# ------------------------------------------------------------------- php + nginx
log "Configuring PHP-FPM and Nginx"
PHP_VER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
PHP_INI="/etc/php/${PHP_VER}/fpm/conf.d/99-mashahir.ini"
cat >"$PHP_INI" <<'INI'
upload_max_filesize = 12M
post_max_size = 13M
memory_limit = 256M
max_execution_time = 60
INI
systemctl restart "php${PHP_VER}-fpm"
systemctl enable "php${PHP_VER}-fpm" >/dev/null
PHP_SOCK="/run/php/php${PHP_VER}-fpm.sock"

NGINX_SITE="/etc/nginx/sites-available/mashahir"
if [[ -f "$NGINX_SITE" ]]; then
    log "Existing Nginx site kept untouched ($NGINX_SITE)"
else
    # HTTP-only on purpose: certbot --nginx adds the 443 block and the redirect.
    sed -e "s|__DOMAIN__|$DOMAIN|g" \
        -e "s|__APP_DIR__|$APP_DIR|g" \
        -e "s|__PHP_SOCK__|$PHP_SOCK|g" >"$NGINX_SITE" <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name __DOMAIN__;

    root __APP_DIR__/frontend/dist;
    index index.html;
    client_max_body_size 12m;

    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy strict-origin-when-cross-origin;

    # API lives in backend/public; the prefix does not exist on disk, so every
    # request falls through to Laravel's front controller.
    location ^~ /api {
        root __APP_DIR__/backend/public;
        try_files $uri /index.php?$query_string;
    }

    location = /up {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME __APP_DIR__/backend/public/index.php;
        fastcgi_param SCRIPT_NAME /index.php;
        fastcgi_param HTTPS $https;
        fastcgi_pass unix:__PHP_SOCK__;
    }

    location = /index.php {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME __APP_DIR__/backend/public/index.php;
        fastcgi_param SCRIPT_NAME /index.php;
        fastcgi_param HTTPS $https;
        fastcgi_read_timeout 60s;
        fastcgi_pass unix:__PHP_SOCK__;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location = /sw.js                { add_header Cache-Control "no-cache"; }
    location = /manifest.webmanifest { add_header Cache-Control "no-cache"; }
    location /assets/                { add_header Cache-Control "public, max-age=31536000, immutable"; }
}
NGINX
fi

ln -sfn "$NGINX_SITE" /etc/nginx/sites-enabled/mashahir
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# ------------------------------------------------------------------------ TLS
TLS_STATE="skipped"
if [[ "$WITH_TLS" -eq 1 ]]; then
    if [[ -z "$TLS_EMAIL" ]]; then
        warn "no --email given; staying on HTTP"
    else
        log "Requesting a certificate for $DOMAIN"
        if certbot --nginx --non-interactive --agree-tos --no-eff-email --redirect -m "$TLS_EMAIL" -d "$DOMAIN"; then
            TLS_STATE="enabled"
        else
            TLS_STATE="failed"
            warn "certbot failed (is $DOMAIN pointing at this server?) — the site stays on HTTP"
        fi
    fi
fi

# -------------------------------------------------------------------- backups
if [[ "$WITH_BACKUPS" -eq 1 ]]; then
    log "Installing the nightly backup job"
    cat >/usr/local/bin/mashahir-backup.sh <<'BACKUP'
#!/usr/bin/env bash
set -euo pipefail
STAMP="$(date +%F)"
DEST="/var/backups/mashahir"
mkdir -p "$DEST"
runuser -u postgres -- pg_dump -Fc __DB_NAME__ > "$DEST/db-$STAMP.dump"
tar czf "$DEST/storage-$STAMP.tgz" -C __APP_DIR__/backend/storage/app/private .
cat __APP_DIR__/backend/.env > "$DEST/env-$STAMP"
find "$DEST" -type f -mtime +14 -delete
BACKUP
    sed -i -e "s|__DB_NAME__|$DB_NAME|g" -e "s|__APP_DIR__|$APP_DIR|g" /usr/local/bin/mashahir-backup.sh
    chmod 700 /usr/local/bin/mashahir-backup.sh
    install -d -m 700 /var/backups/mashahir
    printf '0 2 * * * root /usr/local/bin/mashahir-backup.sh >> /var/log/mashahir-backup.log 2>&1\n' \
        >/etc/cron.d/mashahir-backup
    chmod 644 /etc/cron.d/mashahir-backup
    /usr/local/bin/mashahir-backup.sh
fi

# ------------------------------------------------------------------ permissions
chown -R "$DEPLOY_USER:$DEPLOY_GROUP" "$APP_DIR/backend/storage" "$APP_DIR/backend/bootstrap/cache"
find "$APP_DIR/backend/storage" "$APP_DIR/backend/bootstrap/cache" -type d -exec chmod 2775 {} +
find "$APP_DIR/backend/storage" "$APP_DIR/backend/bootstrap/cache" -type f -exec chmod 664 {} +
chmod 640 "$ENV_FILE"

# ------------------------------------------------------------------- smoke test
log "Smoke test"
if [[ "$TLS_STATE" == "enabled" ]]; then
    status="$(curl -ks -o /dev/null -w '%{http_code}' --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/up" || true)"
else
    status="$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $DOMAIN" "http://127.0.0.1/up" || true)"
fi
printf 'GET /up -> %s\n' "${status:-no-response}"
[[ "$status" == "200" ]] || warn "/up did not return 200; check: journalctl -u php${PHP_VER}-fpm -u nginx"

# --------------------------------------------------------------------- summary
scheme="http"
if [[ "$TLS_STATE" == "enabled" ]]; then
    scheme="https"
fi

cat <<SUMMARY

${BOLD}Done.${NC}
  Site        : ${scheme}://${DOMAIN}
  Code        : ${APP_DIR}
  Database    : ${DB_NAME} (user ${DB_USER}, 127.0.0.1:5432)
  TLS         : ${TLS_STATE}
  Backups     : $([[ "$WITH_BACKUPS" -eq 1 ]] && echo "/usr/local/bin/mashahir-backup.sh + /etc/cron.d/mashahir-backup" || echo "skipped")
  First admin : $([[ -n "$ADMIN_PHONE" ]] && echo "created/verified for ${ADMIN_PHONE}" || echo "NOT created — see backend/README.md")

Next steps
  1. OTP codes still go to backend/storage/logs/laravel.log: implement a real
     SMS driver in app/Support/Sms before real users log in.
  2. Copy backups off the server (they are local only).
  3. Harden SSH only after 'ssh ${DEPLOY_USER}@${DOMAIN}' works with a key.
  4. Updates: git pull, composer install, php artisan migrate, npm ci + build,
     then systemctl reload php${PHP_VER}-fpm (details in backend/README.md).

SUMMARY
