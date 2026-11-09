import React, { useCallback, useEffect, useState } from 'react';
import {
  Bell, Check, Archive, Loader2, AlertCircle, RefreshCw, Inbox
} from 'lucide-react';
import { Card, Button, Tabs, PageHeader, EmptyState } from '../components/common';
import { cn } from '../utils/persian';
import { ApiNotificationCenter } from '../api/data';
import { ApiError } from '../api/client';
import { Notification } from '../types';

type TabId = 'all' | 'unread' | 'important' | 'archived';

const CATEGORY_LABEL: Record<Notification['category'], string> = {
  academic: 'آموزشی',
  attendance: 'حضور و غیاب',
  exam: 'آزمون',
  system: 'اطلاع‌رسانی سامانه',
  counseling: 'مشاوره',
};

const firstError = (e: unknown, fallback: string): string =>
  e instanceof ApiError ? e.firstError() : fallback;

export const NotificationsCenterPage: React.FC = () => {
  // The bell only rings for real server-side events — an empty inbox stays
  // empty instead of showing demo notices.
  const [items, setItems] = useState<Notification[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('all');

  const load = useCallback((tab: TabId) => {
    setItems(null);
    setError(null);

    ApiNotificationCenter.list(tab)
      .then((r) => {
        setItems(r.items);
        setUnreadCount(r.unreadCount);
      })
      .catch((e) => setError(firstError(e, 'خطا در دریافت اعلان‌ها')));
  }, []);

  useEffect(() => { load(activeTab); }, [activeTab, load]);

  const handleMarkAsRead = (id: string) => {
    const numeric = Number(id);
    if (!Number.isFinite(numeric)) return;

    setItems((prev) => prev?.map((n) => (n.id === id ? { ...n, isRead: true } : n)) ?? prev);
    setUnreadCount((c) => Math.max(0, c - 1));

    ApiNotificationCenter.markRead(numeric)
      .catch((e) => setError(firstError(e, 'خطا در علامت‌گذاری اعلان')));
  };

  const handleMarkAllRead = () => {
    const unread = (items ?? []).filter((n) => !n.isRead);
    if (unread.length === 0) return;

    Promise.all(
      unread
        .map((n) => Number(n.id))
        .filter((id) => Number.isFinite(id))
        .map((id) => ApiNotificationCenter.markRead(id)),
    )
      .then(() => load(activeTab))
      .catch((e) => setError(firstError(e, 'خطا در علامت‌گذاری اعلان‌ها')));
  };

  const handleArchive = (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    const numeric = Number(id);
    if (!Number.isFinite(numeric)) return;

    ApiNotificationCenter.archive(numeric)
      .then(() => load(activeTab))
      .catch((e) => setError(firstError(e, 'خطا در بایگانی اعلان')));
  };

  const tabs = [
    { id: 'all', label: 'همه اعلان‌ها', badge: items?.length ?? 0 },
    { id: 'unread', label: 'خوانده‌نشده', badge: unreadCount },
    { id: 'important', label: 'مهم و ستاره‌دار' },
    { id: 'archived', label: 'بایگانی‌شده' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="مرکز اعلان‌ها و هشدارهای هوشمند"
        subtitle="مدیریت پیام‌های آموزشی، حضور و غیاب، آزمون‌ها و رویدادهای سامانه"
        actions={
          unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} icon={<Check size={14} />}>
              علامت‌گذاری همه به عنوان خوانده‌شده
            </Button>
          )
        }
      />

      {error && (
        <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-900 dark:text-rose-200">
            <span className="flex items-center gap-2 font-bold">
              <AlertCircle size={15} />
              {error}
            </span>
            <Button size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={() => load(activeTab)}>
              تلاش دوباره
            </Button>
          </div>
        </Card>
      )}

      <Tabs tabs={tabs} activeId={activeTab} onChange={(id) => setActiveTab(id as TabId)} />

      {items === null && !error ? (
        <Card>
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#526176] dark:text-[#B3C0D2]">
            <Loader2 size={18} className="animate-spin" /> در حال دریافت اعلان‌ها…
          </div>
        </Card>
      ) : (items ?? []).length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
            title="اعلانی در این بخش نیست"
            description={
              unreadCount === 0
                ? 'هر اعلان تازه — غیبت ثبت‌شده، تکلیف نزدیک‌الموعد، نتیجهٔ آزمون یا رضایت‌نامه — به‌صورت خودکار در همین مرکز ظاهر می‌شود.'
                : 'در این تب اعلانی نیست؛ تب‌های دیگر را ببینید.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {(items ?? []).map((notif) => (
            <Card
              key={notif.id}
              onClick={() => { if (!notif.isRead) handleMarkAsRead(notif.id); }}
              className={cn(
                'text-right transition-all',
                !notif.isRead
                  ? 'cursor-pointer border-blue-300 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20'
                  : 'bg-white dark:bg-[#182231]'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                    notif.category === 'attendance'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : notif.category === 'academic'
                      ? 'bg-blue-100 text-[#2457C5] dark:bg-blue-950 dark:text-[#8BAEFF]'
                      : notif.category === 'exam'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  )}>
                    <Bell size={18} />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">{notif.title}</h4>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-[#2457C5] dark:bg-[#8BAEFF]" />
                      )}
                    </div>
                    <p className="text-xs text-[#526176] dark:text-[#B3C0D2] mt-1 leading-relaxed">
                      {notif.message}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-slate-400 font-mono">
                    {notif.createdAt}
                  </span>
                  {!notif.isArchived && (
                    <button
                      type="button"
                      title="بایگانی اعلان"
                      onClick={(e) => handleArchive(e, notif.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#2457C5] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Archive size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                <span>{CATEGORY_LABEL[notif.category] ?? 'اطلاع‌رسانی'}</span>
                <span>{notif.isImportant ? 'اعلان مهم' : 'اعلان عادی'}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
