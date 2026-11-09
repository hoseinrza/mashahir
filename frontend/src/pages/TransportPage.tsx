import React, { useEffect, useState } from 'react';
import {
  Bus, Plus, MapPin, Users, Loader2, AlertCircle, RefreshCw, Trash2, Clock, Power, UserPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Modal, FormField, PageHeader, AccessDeniedGate, EmptyState } from '../components/common';
import { toPersianDigits } from '../utils/persian';
import {
  ApiTransportService, ApiUserService,
  BusRouteRow, StudentRow, UserRow,
} from '../api/data';
import { ApiError } from '../api/client';

const firstError = (e: unknown, fallback: string): string =>
  e instanceof ApiError ? e.firstError() : fallback;

export const TransportPage: React.FC = () => {
  const { activeRole, hasAccess } = useAuth();
  const canManage = hasAccess('transport:manage');
  const isAuthorized = canManage || hasAccess('transport:view');

  const [routes, setRoutes] = useState<BusRouteRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [students, setStudents] = useState<StudentRow[] | null>(null);

  // Create route
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [capacity, setCapacity] = useState(14);
  const [vehicle, setVehicle] = useState('');
  const [plate, setPlate] = useState('');
  const [driverUlid, setDriverUlid] = useState('');

  // Add stop
  const [stopRoute, setStopRoute] = useState<BusRouteRow | null>(null);
  const [stopTitle, setStopTitle] = useState('');
  const [stopTime, setStopTime] = useState('');

  // Assign student
  const [assignRoute, setAssignRoute] = useState<BusRouteRow | null>(null);
  const [assignStudentUlid, setAssignStudentUlid] = useState('');
  const [assignStopUlid, setAssignStopUlid] = useState('');

  // Roster view
  const [rosterRoute, setRosterRoute] = useState<BusRouteRow | null>(null);
  const [roster, setRoster] = useState<{ studentUlid: string | null; studentName: string | null; studentCode: string | null; stopTitle: string | null }[] | null>(null);

  useEffect(() => {
    if (!isAuthorized) return;
    let cancelled = false;

    setRoutes(null);
    setError(null);

    ApiTransportService.routes()
      .then((rows) => { if (!cancelled) setRoutes(rows); })
      .catch((e) => { if (!cancelled) setError(firstError(e, 'خطا در دریافت خطوط سرویس')); });

    return () => { cancelled = true; };
  }, [isAuthorized, reloadKey]);

  const loadLookups = () => {
    if (users === null) {
      ApiUserService.listUsers().then(setUsers).catch(() => setUsers([]));
    }
    if (students === null) {
      ApiUserService.listStudents().then(setStudents).catch(() => setStudents([]));
    }
  };

  if (!isAuthorized) {
    return (
      <AccessDeniedGate
        title="دسترسی به مدیریت سرویس مدرسه"
        requiredRoleOrPermission="transport:view / transport:manage (مدیر مدرسه، مسئول دفتر یا ناظم)"
        reason="خطوط سرویس، ایستگاه‌ها و تخصیص دانش‌آموزان اطلاعات عملیاتی مدرسه است و برای کادر مجاز نمایش داده می‌شود."
        currentRoleTitle={activeRole.persianTitle}
      />
    );
  }

  const openCreate = () => {
    setCode('');
    setTitle('');
    setCapacity(14);
    setVehicle('');
    setPlate('');
    setDriverUlid('');
    setIsCreateOpen(true);
    loadLookups();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !title.trim()) return;

    setIsSaving(true);
    setError(null);
    try {
      await ApiTransportService.createRoute({
        code: code.trim(),
        title: title.trim(),
        capacity,
        vehicleModel: vehicle.trim() || undefined,
        plateNumber: plate.trim() || undefined,
        driverUlid: driverUlid || null,
      });
      setIsCreateOpen(false);
      setReloadKey((k) => k + 1);
      setNotice('خط سرویس ساخته شد.');
    } catch (err) {
      setError(firstError(err, 'خطا در ساخت خط سرویس'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stopRoute || !stopTitle.trim()) return;

    setIsSaving(true);
    setError(null);
    try {
      await ApiTransportService.addStop(stopRoute.ulid, {
        title: stopTitle.trim(),
        pickupTime: stopTime || undefined,
      });
      setStopRoute(null);
      setStopTitle('');
      setStopTime('');
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(firstError(err, 'خطا در افزودن ایستگاه'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignRoute || !assignStudentUlid) return;

    setIsSaving(true);
    setError(null);
    try {
      await ApiTransportService.assign(assignRoute.ulid, assignStudentUlid, assignStopUlid || null);
      setAssignRoute(null);
      setAssignStudentUlid('');
      setAssignStopUlid('');
      setReloadKey((k) => k + 1);
      setNotice('دانش‌آموز به خط اضافه شد.');
    } catch (err) {
      setError(firstError(err, 'خطا در تخصیص دانش‌آموز'));
    } finally {
      setIsSaving(false);
    }
  };

  const openRoster = (route: BusRouteRow) => {
    setRosterRoute(route);
    setRoster(null);
    ApiTransportService.students(route.ulid)
      .then(setRoster)
      .catch((e) => { setError(firstError(e, 'خطا در دریافت دانش‌آموزان خط')); setRoster([]); });
  };

  const removeStudent = async (studentUlid: string) => {
    if (!rosterRoute) return;
    try {
      await ApiTransportService.unassign(rosterRoute.ulid, studentUlid);
      setRoster((prev) => (prev ?? []).filter((r) => r.studentUlid !== studentUlid));
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(firstError(e, 'خطا در حذف دانش‌آموز از خط'));
    }
  };

  const removeStop = async (route: BusRouteRow, stopUlid: string) => {
    try {
      await ApiTransportService.removeStop(route.ulid, stopUlid);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(firstError(e, 'خطا در حذف ایستگاه'));
    }
  };

  const toggleRoute = async (route: BusRouteRow) => {
    try {
      await ApiTransportService.updateRoute(route.ulid, { isActive: !route.isActive });
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(firstError(e, 'خطا در تغییر وضعیت خط'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="سرویس مدرسه — خطوط، ایستگاه‌ها و تخصیص دانش‌آموزان"
        subtitle="هر خط با راننده، وسیله و ظرفیت تعریف می‌شود؛ دانش‌آموز به ایستگاه خط وصل می‌شود و راننده تردد روزانه را ثبت می‌کند"
        actions={
          canManage && (
            <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={openCreate}>
              خط سرویس جدید
            </Button>
          )
        }
      />

      {notice && (
        <Card className="border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
            <Bus size={15} /> <span className="font-bold">{notice}</span>
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

      {routes === null ? (
        <Card>
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#526176] dark:text-[#B3C0D2]">
            <Loader2 size={18} className="animate-spin" /> در حال دریافت خطوط سرویس…
          </div>
        </Card>
      ) : routes.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bus size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
            title="خط سرویسی ثبت نشده است"
            description="با دکمهٔ «خط سرویس جدید» نخستین خط را با کد، عنوان و راننده بسازید؛ سپس ایستگاه‌ها و دانش‌آموزان را اضافه کنید."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {routes.map((route) => (
            <Card key={route.ulid} className="text-right">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DCE3EE] dark:border-[#344257]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="primary">{route.code}</Badge>
                    <Badge variant={route.isActive ? 'success' : 'neutral'}>{route.isActive ? 'فعال' : 'غیرفعال'}</Badge>
                    {route.driver && <Badge variant="warning">راننده: {route.driver.name}</Badge>}
                  </div>
                  <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">{route.title}</h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {route.vehicleModel ?? 'وسیله ثبت نشده'} {route.plateNumber ? `· ${route.plateNumber}` : ''} ·
                    {' '}ظرفیت {toPersianDigits(route.capacity)} · {toPersianDigits(route.studentsCount)} دانش‌آموز
                  </p>
                </div>

                {canManage && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button size="sm" variant="outline" icon={<MapPin size={13} />} onClick={() => { setStopTitle(''); setStopTime(''); setStopRoute(route); }}>
                      افزودن ایستگاه
                    </Button>
                    <Button size="sm" variant="outline" icon={<UserPlus size={13} />} onClick={() => { loadLookups(); setAssignStudentUlid(''); setAssignStopUlid(''); setAssignRoute(route); }}>
                      تخصیص دانش‌آموز
                    </Button>
                    <Button size="sm" variant="ghost" icon={<Users size={13} />} onClick={() => openRoster(route)}>
                      فهرست
                    </Button>
                    <Button size="sm" variant="ghost" icon={<Power size={13} />} onClick={() => toggleRoute(route)}>
                      {route.isActive ? 'غیرفعال' : 'فعال'}
                    </Button>
                  </div>
                )}
              </div>

              <div className="pt-3">
                <span className="text-[11px] font-bold text-[#526176] dark:text-[#B3C0D2] block mb-2">ایستگاه‌های خط:</span>
                {route.stops.length === 0 ? (
                  <p className="text-[11px] text-slate-400">ایستگاهی ثبت نشده است.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {route.stops.map((stop) => (
                      <span
                        key={stop.ulid}
                        className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded-lg flex items-center gap-1.5"
                      >
                        <span className="tabular-nums text-slate-400">{toPersianDigits(stop.position)}.</span>
                        {stop.title}
                        {stop.pickupTime && (
                          <span className="text-slate-400 flex items-center gap-0.5">
                            <Clock size={10} /> {stop.pickupTime}
                          </span>
                        )}
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => removeStop(route, stop.ulid)}
                            className="text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="حذف ایستگاه"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create route */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="خط سرویس جدید" maxWidth="md">
        <form onSubmit={handleCreate} className="space-y-4 text-right">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="کد خط" required>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="خط ۳"
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              />
            </FormField>
            <FormField label="عنوان مسیر" required>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مسیر شمال — تجریش"
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="راننده (کاربر سامانه)">
              <select
                value={driverUlid}
                onChange={(e) => setDriverUlid(e.target.value)}
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              >
                <option value="">{users === null ? 'در حال دریافت…' : 'بدون راننده'}</option>
                {(users ?? []).map((user) => (
                  <option key={user.ulid} value={user.ulid}>{user.fullName}</option>
                ))}
              </select>
            </FormField>
            <FormField label="ظرفیت">
              <input
                type="number"
                min={0}
                max={100}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="مدل وسیله">
              <input
                type="text"
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                placeholder="ون تویوتا هایس"
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              />
            </FormField>
            <FormField label="شمارهٔ پلاک">
              <input
                type="text"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                placeholder="۴۲ ق ۷۸۹ ایران ۳۳"
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsCreateOpen(false)}>انصراف</Button>
            <Button variant="primary" type="submit" disabled={isSaving || !code.trim() || !title.trim()}>
              {isSaving ? 'در حال ذخیره…' : 'ساخت خط'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add stop */}
      <Modal
        isOpen={stopRoute !== null}
        onClose={() => setStopRoute(null)}
        title={`افزودن ایستگاه به ${stopRoute?.code ?? ''}`}
        maxWidth="sm"
      >
        <form onSubmit={handleAddStop} className="space-y-4 text-right">
          <FormField label="عنوان ایستگاه" required>
            <input
              type="text"
              required
              value={stopTitle}
              onChange={(e) => setStopTitle(e.target.value)}
              placeholder="میدان تجریش — نبش خیابان"
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <FormField label="ساعت تقریبی سوارشدن">
            <input
              type="time"
              value={stopTime}
              onChange={(e) => setStopTime(e.target.value)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setStopRoute(null)}>انصراف</Button>
            <Button variant="primary" type="submit" disabled={isSaving || !stopTitle.trim()}>
              {isSaving ? 'در حال ثبت…' : 'افزودن ایستگاه'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assign student */}
      <Modal
        isOpen={assignRoute !== null}
        onClose={() => setAssignRoute(null)}
        title={`تخصیص دانش‌آموز به ${assignRoute?.code ?? ''}`}
        maxWidth="sm"
      >
        <form onSubmit={handleAssign} className="space-y-4 text-right">
          <FormField label="دانش‌آموز" required>
            <select
              value={assignStudentUlid}
              onChange={(e) => setAssignStudentUlid(e.target.value)}
              required
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            >
              <option value="">{students === null ? 'در حال دریافت…' : 'انتخاب دانش‌آموز'}</option>
              {(students ?? []).map((student) => (
                <option key={student.ulid} value={student.ulid}>{student.fullName} — {student.code}</option>
              ))}
            </select>
          </FormField>

          <FormField label="ایستگاه">
            <select
              value={assignStopUlid}
              onChange={(e) => setAssignStopUlid(e.target.value)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            >
              <option value="">بدون ایستگاه مشخص</option>
              {(assignRoute?.stops ?? []).map((stop) => (
                <option key={stop.ulid} value={stop.ulid}>{stop.title}</option>
              ))}
            </select>
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setAssignRoute(null)}>انصراف</Button>
            <Button variant="primary" type="submit" disabled={isSaving || !assignStudentUlid}>
              {isSaving ? 'در حال ثبت…' : 'تخصیص'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Roster */}
      <Modal
        isOpen={rosterRoute !== null}
        onClose={() => setRosterRoute(null)}
        title={`دانش‌آموزان ${rosterRoute?.code ?? ''}`}
        maxWidth="md"
      >
        {roster === null ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-400">
            <Loader2 size={15} className="animate-spin" /> در حال دریافت…
          </div>
        ) : roster.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">دانش‌آموزی به این خط تخصیص نیافته است.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {roster.map((row) => (
              <div key={row.studentUlid ?? ''} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <strong className="text-[#202B3C] dark:text-[#F1F5FB]">{row.studentName}</strong>
                  <span className="text-slate-400 font-mono mr-2">{row.studentCode}</span>
                  <span className="block text-[11px] text-slate-400">{row.stopTitle ?? 'بدون ایستگاه'}</span>
                </div>
                {canManage && row.studentUlid && (
                  <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={() => removeStudent(row.studentUlid as string)}>
                    حذف
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};
