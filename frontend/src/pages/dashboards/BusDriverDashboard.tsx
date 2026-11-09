import React, { useCallback, useEffect, useState } from 'react';
import {
  Bus, Clock, MapPin, CheckCircle2, AlertCircle, Loader2, RefreshCw, Users, Phone,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader, EmptyState } from '../../components/common';
import { toPersianDigits } from '../../utils/persian';
import { ApiTransportService, BusRouteRow, DriverRosterRow, DriverBoardingRow } from '../../api/data';
import { ApiError } from '../../api/client';

interface RowState {
  in?: 'boarded' | 'absent';
  out?: 'boarded' | 'absent';
}

const firstError = (e: unknown, fallback: string): string =>
  e instanceof ApiError ? e.firstError() : fallback;

export const BusDriverDashboard: React.FC = () => {
  const { currentUser } = useAuth();

  const [route, setRoute] = useState<BusRouteRow | null>(null);
  const [roster, setRoster] = useState<DriverRosterRow[]>([]);
  const [boardings, setBoardings] = useState<DriverBoardingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyStudent, setBusyStudent] = useState<string | null>(null);

  const load = useCallback(() => {
    setIsLoading(true);
    setError(null);

    ApiTransportService.myRoute()
      .then((payload) => {
        setRoute(payload.route);
        setRoster(payload.roster);
        setBoardings(payload.boardings);
      })
      .catch((e) => setError(firstError(e, 'خطا در دریافت خط سرویس')))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const mark = (studentUlid: string, direction: 'in' | 'out', status: 'boarded' | 'absent') => {
    if (!route) return;

    setBusyStudent(`${studentUlid}:${direction}`);
    setError(null);

    ApiTransportService.markBoarding({ routeUlid: route.ulid, studentUlid, direction, status })
      .then(() => {
        setBoardings((prev) => {
          const rest = prev.filter((b) => !(b.student_ulid === studentUlid && b.direction === direction));
          return [...rest, { student_ulid: studentUlid, direction, status, recorded_at: new Date().toISOString() }];
        });
      })
      .catch((e) => setError(firstError(e, 'خطا در ثبت وضعیت')))
      .finally(() => setBusyStudent(null));
  };

  const stateFor = (studentUlid: string): RowState => {
    const row: RowState = {};
    boardings
      .filter((b) => b.student_ulid === studentUlid)
      .forEach((b) => {
        if (b.direction === 'in') row.in = b.status as 'boarded' | 'absent';
        if (b.direction === 'out') row.out = b.status as 'boarded' | 'absent';
      });
    return row;
  };

  const boardedIn = roster.filter((r) => r.studentUlid && stateFor(r.studentUlid).in === 'boarded').length;
  const boardedOut = roster.filter((r) => r.studentUlid && stateFor(r.studentUlid).out === 'boarded').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`سرویس دانش‌آموزی — ${currentUser.fullName}`}
        subtitle="ثبت لحظه‌ای سوار و پیاده‌شدن دانش‌آموزان در ایستگاه‌ها"
        actions={
          <Button variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={load}>
            به‌روزرسانی
          </Button>
        }
      />

      {error && (
        <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
          <div className="flex items-center gap-2 text-xs text-rose-900 dark:text-rose-200 font-bold">
            <AlertCircle size={15} /> {error}
          </div>
        </Card>
      )}

      {isLoading ? (
        <Card>
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#526176] dark:text-[#B3C0D2]">
            <Loader2 size={18} className="animate-spin" /> در حال دریافت خط سرویس…
          </div>
        </Card>
      ) : route === null ? (
        <Card>
          <EmptyState
            icon={<Bus size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
            title="خط سرویسی به شما تخصیص نیافته است"
            description="مدیر مدرسه یا مسئول دفتر باید ابتدا خط سرویس را بسازد و شما را به‌عنوان رانندهٔ آن خط تعیین کند."
          />
        </Card>
      ) : (
        <>
          <Card className="text-right">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="primary">{route.code}</Badge>
                  <Badge variant={route.isActive ? 'success' : 'neutral'}>
                    {route.isActive ? 'فعال امروز' : 'غیرفعال'}
                  </Badge>
                </div>
                <h3 className="text-base font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
                  <Bus size={16} className="text-[#2457C5]" /> {route.title}
                </h3>
                <p className="text-xs text-[#526176] dark:text-[#B3C0D2] mt-1">
                  {route.vehicleModel ?? 'وسیله ثبت نشده'} {route.plateNumber ? `· ${route.plateNumber}` : ''}
                  {' '}· ظرفیت {toPersianDigits(route.capacity)} نفر · {toPersianDigits(roster.length)} دانش‌آموز
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-center">
                  <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{toPersianDigits(boardedIn)}</div>
                  <div className="text-[10px] text-emerald-700/70 dark:text-emerald-300/70">سوار صبح</div>
                </div>
                <div className="px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-center">
                  <div className="text-sm font-bold text-[#2457C5] dark:text-[#8BAEFF]">{toPersianDigits(boardedOut)}</div>
                  <div className="text-[10px] text-[#2457C5]/70 dark:text-[#8BAEFF]/70">پیادهٔ عصر</div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="text-right">
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3 flex items-center gap-2">
              <Users size={16} className="text-[#2457C5]" />
              دانش‌آموزان امروز
            </h3>

            {roster.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">هنوز دانش‌آموزی به این خط تخصیص نیافته است.</p>
            ) : (
              <div className="space-y-2">
                {roster.map((student) => {
                  if (!student.studentUlid) return null;
                  const ulid = student.studentUlid;
                  const state = stateFor(ulid);

                  return (
                    <div
                      key={ulid}
                      className="p-3 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#101722]/60 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <strong className="text-sm text-[#202B3C] dark:text-[#F1F5FB]">{student.studentName}</strong>
                        <span className="text-slate-400 font-mono mr-2">{student.studentCode}</span>
                        <div className="text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1">
                            <MapPin size={11} /> {student.stopTitle ?? 'ایستگاه ثبت نشده'}
                          </span>
                          {student.pickupTime && (
                            <span className="flex items-center gap-1">
                              <Clock size={11} /> {student.pickupTime}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-slate-400">صبح:</span>
                        <Button
                          size="sm"
                          variant={state.in === 'boarded' ? 'primary' : 'outline'}
                          disabled={busyStudent === `${ulid}:in`}
                          onClick={() => mark(ulid, 'in', 'boarded')}
                        >
                          سوار شد
                        </Button>
                        <Button
                          size="sm"
                          variant={state.in === 'absent' ? 'danger' : 'ghost'}
                          disabled={busyStudent === `${ulid}:in`}
                          onClick={() => mark(ulid, 'in', 'absent')}
                        >
                          غایب
                        </Button>

                        <span className="text-[11px] text-slate-400 mr-2">عصر:</span>
                        <Button
                          size="sm"
                          variant={state.out === 'boarded' ? 'primary' : 'outline'}
                          disabled={busyStudent === `${ulid}:out`}
                          onClick={() => mark(ulid, 'out', 'boarded')}
                        >
                          پیاده شد
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="text-right bg-slate-50 dark:bg-slate-800/30">
            <div className="flex items-start gap-2 text-[11px] text-slate-500">
              <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-600" />
              <span>
                هر ثبت بلافاصله روی سرور ذخیره می‌شود و برای پیگیری مدرسه قابل مشاهده است.
                در صورت بروز مشکل با دفتر مدرسه تماس بگیرید.
              </span>
              <Phone size={13} className="ml-auto text-slate-400" />
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
