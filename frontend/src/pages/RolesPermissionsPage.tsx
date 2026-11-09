import React, { useEffect, useMemo, useState } from 'react';
import {
  Layers, Shield, Plus, Search, Trash2, Loader2, AlertCircle, RefreshCw, Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Modal, FormField, SearchInput, PageHeader, AccessDeniedGate, EmptyState } from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import { ApiRolesService, SchoolRoleRow } from '../api/data';
import { ApiError } from '../api/client';

type FilterId = 'all' | 'system' | 'custom';

const firstError = (e: unknown, fallback: string): string =>
  e instanceof ApiError ? e.firstError() : fallback;

export const RolesPermissionsPage: React.FC = () => {
  const { activeRole } = useAuth();
  const isAuthorized = activeRole.group === 'school_admin' || activeRole.group === 'platform';

  // Roles come from the single permission matrix (system) plus the school's
  // own custom roles — nothing is stored in the browser.
  const [roles, setRoles] = useState<SchoolRoleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState<FilterId>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [isCreateRoleModalOpen, setIsCreateRoleModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [roleTitle, setRoleTitle] = useState('');
  const [roleKey, setRoleKey] = useState('');
  const [selectedPermKeys, setSelectedPermKeys] = useState<string[]>([]);
  const [deletingRole, setDeletingRole] = useState<SchoolRoleRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isAuthorized) return;
    let cancelled = false;

    setRoles(null);
    setError(null);

    ApiRolesService.list()
      .then((rows) => { if (!cancelled) setRoles(rows); })
      .catch((e) => {
        if (!cancelled) setError(firstError(e, 'خطا در دریافت نقش‌ها'));
      });

    return () => { cancelled = true; };
  }, [isAuthorized, reloadKey]);

  /** Every permission the matrix knows, harvested from the system-role payloads. */
  const permissionCatalog = useMemo(() => {
    const map = new Map<string, string>();
    (roles ?? []).forEach((role) => role.permissions.forEach((p) => map.set(p.key, p.title)));
    return Array.from(map, ([key, title]) => ({ key, title }))
      .sort((a, b) => a.title.localeCompare(b.title, 'fa'));
  }, [roles]);

  if (!isAuthorized) {
    return (
      <AccessDeniedGate
        title="دسترسی به مدیریت نقش‌ها و مجوزهای سامانه"
        requiredRoleOrPermission="school_principal یا platform_super_admin"
        reason="تعریف الگوهای دسترسی، افزودن نقش‌های سفارشی و تغییر مجوزها تنها در صلاحیت مدیریت مدرسه و ادمین پلتفرم است."
        currentRoleTitle={activeRole.persianTitle}
      />
    );
  }

  const togglePermission = (key: string) => {
    setSelectedPermKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const openCreateModal = () => {
    setRoleTitle('');
    setRoleKey('');
    setSelectedPermKeys([]);
    setIsCreateRoleModalOpen(true);
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleTitle.trim() || !/^[a-z0-9_]{3,50}$/.test(roleKey) || selectedPermKeys.length === 0) return;

    setIsSaving(true);
    setError(null);
    try {
      await ApiRolesService.create(roleKey, roleTitle.trim(), selectedPermKeys);
      setIsCreateRoleModalOpen(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(firstError(err, 'خطا در ایجاد نقش سفارشی'));
      setIsSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!deletingRole) return;

    setIsDeleting(true);
    setError(null);
    try {
      await ApiRolesService.destroy(deletingRole.id);
      setDeletingRole(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(firstError(err, 'خطا در حذف نقش'));
    } finally {
      setIsDeleting(false);
    }
  };

  const filters: { id: FilterId; label: string }[] = [
    { id: 'all', label: 'همه نقش‌ها' },
    { id: 'system', label: 'نقش‌های پایه (از فایل ماتریس)' },
    { id: 'custom', label: 'نقش‌های سفارشی مدرسه' },
  ];

  const filteredRoles = (roles ?? []).filter((r) => {
    if (selectedFilter === 'system' && !r.isSystem) return false;
    if (selectedFilter === 'custom' && r.isSystem) return false;
    if (searchQuery && !r.title.includes(searchQuery) && !r.key.includes(searchQuery)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="مدیریت نقش‌ها، مجوزها و سطوح دسترسی"
        subtitle="نقش‌های پایه از فایل واحد ماتریس مجوزها می‌آیند و تغییرناپذیرند؛ نقش‌های سفارشی مدرسه از همین صفحه ساخته و حذف می‌شوند"
        actions={
          <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={openCreateModal}>
            تعریف نقش سفارشی جدید
          </Button>
        }
      />

      {error && (
        <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-900 dark:text-rose-200">
            <span className="flex items-center gap-2 font-bold">
              <AlertCircle size={15} />
              {error}
            </span>
            <Button size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={() => setReloadKey((k) => k + 1)}>
              تلاش دوباره
            </Button>
          </div>
        </Card>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#DCE3EE] dark:border-[#344257]">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedFilter(f.id)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap cursor-pointer',
                selectedFilter === f.id
                  ? 'bg-[#2457C5] text-white dark:bg-[#8BAEFF] dark:text-[#101722]'
                  : 'bg-white dark:bg-[#182231] text-[#526176] dark:text-[#B3C0D2] border border-[#DCE3EE] dark:border-[#344257]'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="جستجو در عناوین نقش‌ها..."
        />
      </div>

      {roles === null ? (
        <Card>
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#526176] dark:text-[#B3C0D2]">
            <Loader2 size={18} className="animate-spin" /> در حال دریافت نقش‌ها…
          </div>
        </Card>
      ) : filteredRoles.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Layers size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
            title="نقشی برای نمایش نیست"
            description={
              (roles?.length ?? 0) === 0
                ? 'نقش‌های پایه هنوز از ماتریس مجوزها همگام نشده‌اند؛ پس از اجرای seeder این فهرست پر می‌شود.'
                : 'در این دسته یا با این عبارت جستجو نقشی پیدا نشد.'
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRoles.map((role) => (
            <Card key={role.id} className="text-right flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Badge variant={role.isSystem ? 'primary' : 'warning'}>
                    {role.isSystem ? 'پایه استاندارد' : 'سفارشی مدرسه'}
                  </Badge>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {toPersianDigits(role.permissions.length)} مجوز
                  </span>
                </div>

                <h3 className="font-bold text-sm text-[#202B3C] dark:text-[#F1F5FB] mb-1">
                  {role.title}
                </h3>
                <p className="text-[11px] text-slate-400 font-mono mb-3" dir="ltr">
                  {role.key}
                </p>

                <div className="flex flex-wrap gap-1 mb-3">
                  {role.permissions.slice(0, 3).map((perm) => (
                    <span
                      key={perm.key}
                      className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded"
                    >
                      {perm.title}
                    </span>
                  ))}
                  {role.permissions.length > 3 && (
                    <span className="text-[10px] text-slate-400 px-1 py-0.5">
                      +{toPersianDigits(role.permissions.length - 3)} مجوز دیگر
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  {role.isSystem ? <Lock size={11} /> : <Shield size={11} />}
                  {role.isSystem ? 'تغییر فقط از فایل ماتریس' : 'قابل ویرایش در این مدرسه'}
                </span>
                {!role.isSystem && (
                  <button
                    type="button"
                    title="حذف نقش سفارشی"
                    onClick={() => setDeletingRole(role)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Custom Role Modal */}
      <Modal
        isOpen={isCreateRoleModalOpen}
        onClose={() => setIsCreateRoleModalOpen(false)}
        title="تعریف نقش سفارشی و تخصیص مجوزها"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateRole} className="space-y-4 text-right">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="عنوان فارسی نقش" required>
              <input
                type="text"
                required
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="مثال: سرپرست المپیادهای علمی"
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              />
            </FormField>

            <FormField label="کلید لاتین نقش (شناسه فنی)" required>
              <input
                type="text"
                required
                dir="ltr"
                value={roleKey}
                onChange={(e) => setRoleKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                placeholder="olympiad_supervisor"
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono"
              />
            </FormField>
          </div>

          <div>
            <span className="text-xs font-bold text-[#202B3C] dark:text-[#F1F5FB] block mb-2">
              انتخاب مجوزهای اعطایی به این نقش (از ماتریس مجوزهای سامانه):
            </span>
            <div className="max-h-60 overflow-y-auto space-y-1.5 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
              {permissionCatalog.map((perm) => {
                const isChecked = selectedPermKeys.includes(perm.key);
                return (
                  <label
                    key={perm.key}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-white dark:hover:bg-[#182231] transition-colors cursor-pointer text-xs"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePermission(perm.key)}
                        className="rounded"
                      />
                      <span className="font-semibold text-[#202B3C] dark:text-[#F1F5FB]">{perm.title}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono" dir="ltr">{perm.key}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {toPersianDigits(selectedPermKeys.length)} مجوز انتخاب شده
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsCreateRoleModalOpen(false)}>
              انصراف
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={isSaving || !roleTitle.trim() || !/^[a-z0-9_]{3,50}$/.test(roleKey) || selectedPermKeys.length === 0}
            >
              {isSaving ? 'در حال ذخیره…' : 'ذخیره و ایجاد نقش'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Custom Role Confirmation */}
      <Modal
        isOpen={deletingRole !== null}
        onClose={() => setDeletingRole(null)}
        title="حذف نقش سفارشی"
        maxWidth="sm"
      >
        <div className="space-y-4 text-right text-xs">
          <p className="text-[#526176] dark:text-[#B3C0D2] leading-relaxed">
            نقش «{deletingRole?.title}» حذف می‌شود. اگر این نقش به کاربری تخصیص یافته باشد،
            حذف انجام نمی‌شود و باید نخست تخصیص‌ها پایان یابند.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setDeletingRole(null)}>
              انصراف
            </Button>
            <Button variant="danger" type="button" disabled={isDeleting} onClick={handleDeleteRole}>
              {isDeleting ? 'در حال حذف…' : 'حذف نقش'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
