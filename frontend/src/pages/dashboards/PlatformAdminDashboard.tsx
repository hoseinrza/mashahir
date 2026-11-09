import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  School, Plus, Loader2, AlertCircle, RefreshCw, UserCheck, Search,
  ShieldCheck, Building2, Users, Power,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, Modal, PageHeader, AccessDeniedGate, EmptyState, FormField } from '../../components/common';
import { toPersianDigits } from '../../utils/persian';
import { ApiSchoolsService, SchoolRow, SCHOOL_LEVEL_LABEL } from '../../api/data';
import { ApiError } from '../../api/client';

const firstError = (e: unknown, fallback: string): string =>
  e instanceof ApiError ? e.firstError() : fallback;

export const PlatformAdminDashboard: React.FC = () => {
  const { currentUser, activeRole, hasAccess } = useAuth();
  const isAuthorized = hasAccess('schools:manage');

  const [schools, setSchools] = useState<SchoolRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [principalTarget, setPrincipalTarget] = useState<SchoolRow | null>(null);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<{ ulid: string; name: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!isAuthorized) return;
    let cancelled = false;

    setSchools(null);
    setError(null);

    ApiSchoolsService.list()
      .then((rows) => { if (!cancelled) setSchools(rows); })
      .catch((e) => { if (!cancelled) setError(firstError(e, 'خطا در دریافت مدارس')); });

    return () => { cancelled = true; };
  }, [isAuthorized, reloadKey]);

  const stats = useMemo(() => {
    const all = schools ?? [];
    return {
      total: all.length,
      active: all.filter((s) => s.isActive).length,
      high: all.filter((s) => s.level === 'high').length,
    };
  }, [schools]);

  if (!isAuthorized) {
    return (
      <AccessDeniedGate
        title="دسترسی به کنسول مدیر پلتفرم"
        requiredRoleOrPermission="schools:manage (مدیر پلتفرم)"
        reason="فهرست مدارس و تخصیص مدیر تنها در اختیار مدیر فنی پلتفرم است؛ این کاربر هیچ محتوای آموزشی نمی‌بیند."
        currentRoleTitle={activeRole.persianTitle}
      />
    );
  }

  const openPrincipalModal = (school: SchoolRow) => {
    setPrincipalTarget(school);
    setQuery('');
    setCandidates([]);
    setError(null);
  };

  const searchCandidates = async () => {
    if (query.trim().length < 2) return;
    setIsSearching(true);
    setError(null);
    try {
      setCandidates(await ApiSchoolsService.candidates(query));
    } catch (e) {
      setError(firstError(e, 'خطا در جست‌وجوی کاربران'));
    } finally {
      setIsSearching(false);
    }
  };

  const assignPrincipal = async (candidate: { ulid: string; name: string }) => {
    if (!principalTarget) return;
    setAssigning(true);
    setError(null);
    try {
      await ApiSchoolsService.assignPrincipal(principalTarget.ulid, candidate.ulid);
      setNotice(`${candidate.name} به‌عنوان مدیر «${principalTarget.name}» تخصیص یافت.`);
      setPrincipalTarget(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(firstError(e, 'خطا در تخصیص مدیر'));
    } finally {
      setAssigning(false);
    }
  };

  const toggleActive = async (school: SchoolRow) => {
    setError(null);
    try {
      await ApiSchoolsService.update(school.ulid, { isActive: !school.isActive });
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(firstError(e, 'خطا در تغییر وضعیت مدرسه'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`کنسول مدیر پلتفرم — ${currentUser.fullName}`}
        subtitle="فهرست مدارس، وضعیت فعال‌بودن و تخصیص مدیر — مدرسه‌ها از همین‌جا ساخته می‌شوند"
        actions={
          <Link to="/create-school">
            <Button variant="primary" size="sm" icon={<Plus size={15} />}>مدرسهٔ جدید</Button>
          </Link>
        }
      />

      {notice && (
        <Card className="border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
            <ShieldCheck size={15} /> <span className="font-bold">{notice}</span>
          </div>
        </Card>
      )}

      {error && (
        <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-900 dark:text-rose-200">
            <span className="flex items-center gap-2 font-bold"><AlertCircle size={15} />{error}</span>
            <Button size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={() => setReloadKey((k) => k + 1)}>
              تلاش دوباره
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center">
          <div className="text-lg font-bold text-[#202B3C] dark:text-[#F1F5FB]">{schools === null ? '…' : toPersianDigits(stats.total)}</div>
          <div className="text-[11px] text-slate-400">کل مدارس</div>
        </Card>
        <Card className="text-center">
          <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{schools === null ? '…' : toPersianDigits(stats.active)}</div>
          <div className="text-[11px] text-slate-400">مدارس فعال</div>
        </Card>
        <Card className="text-center">
          <div className="text-lg font-bold text-[#2457C5] dark:text-[#8BAEFF]">{schools === null ? '…' : toPersianDigits(stats.high)}</div>
          <div className="text-[11px] text-slate-400">متوسطهٔ دوم</div>
        </Card>
      </div>

      {schools === null ? (
        <Card>
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#526176] dark:text-[#B3C0D2]">
            <Loader2 size={18} className="animate-spin" /> در حال دریافت مدارس…
          </div>
        </Card>
      ) : schools.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Building2 size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
            title="مدرسه‌ای ثبت نشده است"
            description="با دکمهٔ «مدرسهٔ جدید» نخستین مدرسه را بسازید؛ پس از آن می‌توانید مدیر و سال تحصیلی را تعیین کنید."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {schools.map((school) => (
            <Card key={school.ulid} className="text-right">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="primary">{SCHOOL_LEVEL_LABEL[school.level] ?? school.level}</Badge>
                    <Badge variant={school.isActive ? 'success' : 'neutral'}>
                      {school.isActive ? 'فعال' : 'غیرفعال'}
                    </Badge>
                  </div>
                  <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
                    <School size={14} className="text-slate-400" />
                    {school.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono mt-1" dir="ltr">{school.ulid}</p>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400">
                  {school.gradingType === 'numeric' ? 'ارزشیابی نمره‌ای' : 'ارزشیابی توصیفی'} ·
                  {' '}{school.timezone}
                </span>

                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" icon={<UserCheck size={13} />} onClick={() => openPrincipalModal(school)}>
                    تخصیص مدیر
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Power size={13} />}
                    onClick={() => toggleActive(school)}
                    title={school.isActive ? 'غیرفعال‌سازی مدرسه' : 'فعال‌سازی مدرسه'}
                  >
                    {school.isActive ? 'غیرفعال' : 'فعال'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={principalTarget !== null}
        onClose={() => setPrincipalTarget(null)}
        title={`تخصیص مدیر برای «${principalTarget?.name ?? ''}»`}
        maxWidth="md"
      >
        <div className="space-y-4 text-right">
          <FormField label="جست‌وجوی کاربر (نام یا شمارهٔ موبایل)" required>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchCandidates(); } }}
                placeholder="مثال: احمدی یا 0912..."
                className="flex-1 text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              />
              <Button size="sm" variant="outline" icon={isSearching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} onClick={searchCandidates} disabled={isSearching || query.trim().length < 2}>
                جست‌وجو
              </Button>
            </div>
          </FormField>

          {candidates.length === 0 ? (
            <p className="text-[11px] text-slate-400">
              دست‌کم دو حرف از نام یا شمارهٔ موبایل را وارد کنید. کاربر باید از قبل در سامانه ثبت شده باشد.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-[#DCE3EE] dark:border-[#344257] rounded-xl overflow-hidden">
              {candidates.map((candidate) => (
                <button
                  key={candidate.ulid}
                  type="button"
                  disabled={assigning}
                  onClick={() => assignPrincipal(candidate)}
                  className="w-full text-right p-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 flex items-center justify-between cursor-pointer"
                >
                  <span className="font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
                    <Users size={13} className="text-slate-400" /> {candidate.name}
                  </span>
                  <span className="text-[11px] text-[#2457C5] dark:text-[#8BAEFF]">تخصیص مدیر</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="ghost" type="button" onClick={() => setPrincipalTarget(null)}>بستن</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
