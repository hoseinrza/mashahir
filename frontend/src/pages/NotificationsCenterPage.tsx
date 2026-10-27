import React, { useState } from 'react';
import {
  Bell, CheckCircle2, Bookmark, Archive, Check,
  Clock, ShieldAlert, BookOpen, HeartHandshake, Settings
} from 'lucide-react';
import { Card, Button, Badge, Tabs, PageHeader } from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import { NotificationService } from '../services';
import { Notification } from '../types';

export const NotificationsCenterPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    NotificationService.getAll()
  );
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'important' | 'archived'>('all');

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAsRead = (id: string) => {
    const updated = NotificationService.markAsRead(id);
    setNotifications(updated);
  };

  const handleMarkAllRead = () => {
    const updated = NotificationService.markAllAsRead();
    setNotifications(updated);
  };

  const tabs = [
    { id: 'all', label: 'همه اعلان‌ها', badge: notifications.length },
    { id: 'unread', label: 'خوانده‌نشده', badge: unreadCount },
    { id: 'important', label: 'مهم و ستاره‌دار' },
    { id: 'archived', label: 'بایگانی‌شده' },
  ];

  const filtered = notifications.filter((n) => {
    if (activeTab === 'unread') return !n.isRead;
    if (activeTab === 'important') return n.isImportant;
    if (activeTab === 'archived') return n.isArchived;
    return true;
  });

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

      <Tabs tabs={tabs} activeId={activeTab} onChange={(id) => setActiveTab(id as any)} />

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="text-center py-12 text-slate-400 text-xs">
            هیچ اعلانی در این بخش وجود ندارد.
          </Card>
        ) : (
          filtered.map((notif) => (
            <Card
              key={notif.id}
              onClick={() => handleMarkAsRead(notif.id)}
              className={cn(
                'text-right transition-all cursor-pointer',
                !notif.isRead
                  ? 'border-blue-300 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20'
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

                <span className="text-[11px] text-slate-400 font-mono shrink-0">
                  {notif.createdAt}
                </span>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
