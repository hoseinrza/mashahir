import React, { useState } from 'react';
import {
  Layers, Shield, Plus, CheckCircle2, Lock,
  ChevronDown, Search, Check, AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Modal, FormField, SearchInput, PageHeader, AccessDeniedGate, RolePermissionBadge } from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import { ALL_PERMISSIONS, BASE_ROLES } from '../permissions';
import { ApiRolesService } from '../api/data';
import { UserService } from '../services';
import { Role, PermissionScope } from '../types';

export const RolesPermissionsPage: React.FC = () => {
  const { activeRole } = useAuth();
  const isAuthorized = activeRole.group === 'school_admin' || activeRole.group === 'platform';

  const [roles, setRoles] = useState<Role[]>(() => UserService.getRoles());
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Create Custom Role Modal
  const [isCreateRoleModalOpen, setIsCreateRoleModalOpen] = useState(false);
  const [customRoleName, setCustomRoleName] = useState('');
  const [customRoleTitle, setCustomRoleTitle] = useState('');
  const [customRoleDesc, setCustomRoleDesc] = useState('');
  const [customDefaultScope, setCustomDefaultScope] = useState<PermissionScope>('school');
  const [selectedPermCodes, setSelectedPermCodes] = useState<string[]>([]);

  if (!isAuthorized) {
    return (
      <AccessDeniedGate
        title="دسترسی به ماتریس نقش‌ها و مدیریت مجوزهای RBAC"
        requiredRoleOrPermission="school_principal یا platform_super_admin"
        reason="تعریف الگوهای دسترسی، افزودن نقش‌های سفارشی و تغییر مجوزها تنها در صلاحیت مدیریت مدرسه و ادمین پلتفرم است."
        currentRoleTitle={activeRole.persianTitle}
      />
    );
  }

  const handleTogglePerm = (code: string) => {
    setSelectedPermCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSaveCustomRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customRoleTitle || selectedPermCodes.length === 0) return;

    const newRole: Role = {
      id: `custom_role_${Date.now()}`,
      name: customRoleName || customRoleTitle,
      persianTitle: customRoleTitle,
      group: 'custom',
      description: customRoleDesc,
      isCustom: true,
      allowedPermissions: selectedPermCodes,
      defaultScope: customDefaultScope,
    };

    const updated = UserService.saveCustomRole(newRole);
    setRoles(updated);

    // Persist through the real API; the demo store is the offline fallback.
    const key = 'custom_' + Date.now().toString(36);
    ApiRolesService.create(key, customRoleTitle, selectedPermCodes)
      .catch(() => { /* demo-only role when the API is unreachable */ });

    setIsCreateRoleModalOpen(false);
    setCustomRoleTitle('');
    setCustomRoleDesc('');
    setSelectedPermCodes([]);
  };

  const groups = [
    { id: 'all', label: 'همه نقش‌ها' },
    { id: 'school_admin', label: 'مدیریت مدرسه' },
    { id: 'faculty', label: 'کادر آموزشی و دبیران' },
    { id: 'family', label: 'اولیا و خانواده' },
    { id: 'student', label: 'دانش‌آموزان' },
    { id: 'support', label: 'مشاوره و سلامت' },
    { id: 'operations', label: 'اجرایی و تردد' },
    { id: 'pta', label: 'انجمن اولیا' },
    { id: 'custom', label: 'نقش‌های سفارشی' },
  ];

  const filteredRoles = roles.filter((r) => {
    if (selectedGroup !== 'all' && r.group !== selectedGroup) return false;
    if (searchQuery && !r.persianTitle.includes(searchQuery) && !r.description.includes(searchQuery)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="مدیریت نقش‌ها، مجوزها و معماری RBAC"
        subtitle="تعریف ۳۰ نقش پایه و امکان ایجاد نقش‌های سفارشی با انتخاب دقیق دسترسی‌ها و قلمرو"
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={15} />}
            onClick={() => setIsCreateRoleModalOpen(true)}
          >
            تعریف نقش سفارشی جدید
          </Button>
        }
      />

      {/* Filter and Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#DCE3EE] dark:border-[#344257]">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelectedGroup(g.id)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap cursor-pointer',
                selectedGroup === g.id
                  ? 'bg-[#2457C5] text-white dark:bg-[#8BAEFF] dark:text-[#101722]'
                  : 'bg-white dark:bg-[#182231] text-[#526176] dark:text-[#B3C0D2] border border-[#DCE3EE] dark:border-[#344257]'
              )}
            >
              {g.label}
            </button>
          ))}
        </div>

        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="جستجو در عناوین نقش‌ها..."
        />
      </div>

      {/* Roles Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRoles.map((role) => (
          <Card key={role.id} className="text-right flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Badge variant={role.isCustom ? 'warning' : 'primary'}>
                  {role.isCustom ? 'سفارشی' : 'پایه استاندارد'}
                </Badge>
                <span className="text-[11px] text-slate-400 font-mono">
                  {role.allowedPermissions.length} مجوز مجاز
                </span>
              </div>

              <h3 className="font-bold text-sm text-[#202B3C] dark:text-[#F1F5FB] mb-1">
                {role.persianTitle}
              </h3>
              <p className="text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed mb-4">
                {role.description}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-500 block mb-1.5">نمونه مجوزهای فعال:</span>
              <div className="flex flex-wrap gap-1">
                {role.allowedPermissions.slice(0, 3).map((code) => {
                  const perm = ALL_PERMISSIONS.find((p) => p.code === code);
                  return (
                    <span
                      key={code}
                      className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded"
                    >
                      {perm?.name || code}
                    </span>
                  );
                })}
                {role.allowedPermissions.length > 3 && (
                  <span className="text-[10px] text-slate-400 px-1 py-0.5">
                    +{toPersianDigits(role.allowedPermissions.length - 3)} مجوز دیگر
                  </span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Create Custom Role Modal */}
      <Modal
        isOpen={isCreateRoleModalOpen}
        onClose={() => setIsCreateRoleModalOpen(false)}
        title="تعریف نقش سفارشی و تخصیص مجوزها"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveCustomRole} className="space-y-4 text-right">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="عنوان فارسی نقش" required>
              <input
                type="text"
                required
                value={customRoleTitle}
                onChange={(e) => setCustomRoleTitle(e.target.value)}
                placeholder="مثال: سرپرست المپیادهای علمی"
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              />
            </FormField>

            <FormField label="قلمرو پیش‌فرض (Default Scope)" required>
              <select
                value={customDefaultScope}
                onChange={(e) => setCustomDefaultScope(e.target.value as PermissionScope)}
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              >
                <option value="school">سطح کل مدرسه</option>
                <option value="classroom">سطح کلاس</option>
                <option value="student">سطح دانش‌آموز</option>
              </select>
            </FormField>
          </div>

          <FormField label="شرح مسئولیت‌ها و مأموریت نقش" required>
            <textarea
              rows={2}
              required
              value={customRoleDesc}
              onChange={(e) => setCustomRoleDesc(e.target.value)}
              placeholder="توضیح مأموریت و حوزه اختیارات این نقش..."
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          {/* Granular Permission Checkboxes */}
          <div>
            <span className="text-xs font-bold text-[#202B3C] dark:text-[#F1F5FB] block mb-2">
              انتخاب مجوزهای اعطایی به این نقش (از فهرست مجوزهای کلان سامانه):
            </span>
            <div className="max-h-60 overflow-y-auto space-y-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
              {ALL_PERMISSIONS.map((perm) => {
                const isChecked = selectedPermCodes.includes(perm.code);
                return (
                  <label
                    key={perm.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-[#182231] transition-colors cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleTogglePerm(perm.code)}
                        className="rounded"
                      />
                      <span className="font-semibold text-[#202B3C] dark:text-[#F1F5FB]">{perm.name}</span>
                    </div>
                    <span className="text-[11px] text-[#526176] dark:text-[#B3C0D2]">{perm.description}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsCreateRoleModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" type="submit" disabled={!customRoleTitle || selectedPermCodes.length === 0}>
              ذخیره و ایجاد نقش
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
