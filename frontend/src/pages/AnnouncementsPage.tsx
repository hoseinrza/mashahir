import React, { useEffect, useState } from 'react';
import {
  Megaphone, Calendar, Plus, Pencil,
  Send, Radio, AlertCircle, Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Modal, FormField, PageHeader, EmptyState } from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import { formatJalaliDate } from '../utils/jalali';
import { ApiAnnouncementService } from '../api/data';
import { ApiError } from '../api/client';
import { JalaliDatePicker } from '../components/common/JalaliDatePicker';
import { Announcement } from '../types';

const CATEGORY_BADGE: Record<Announcement['category'], { label: string; variant: 'danger' | 'primary' | 'neutral' }> = {
  urgent: { label: 'فوری', variant: 'danger' },
  official: { label: 'بخشنامهٔ رسمی', variant: 'primary' },
  educational: { label: 'آموزشی', variant: 'neutral' },
};

const firstError = (e: unknown, fallback: string): string =>
  e instanceof ApiError ? e.firstError() : fallback;

export const AnnouncementsPage: React.FC = () => {
  const { hasAccess } = useAuth();
  const canPublish = hasAccess('announcements:publish');

  // The official channel is backed by the backend alone — an empty school
  // shows an empty channel, never a fabricated bulletin.
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ApiAnnouncementService.list()
      .then((rows) => { if (!cancelled) setAnnouncements(rows); })
      .catch((e) => { if (!cancelled) setError(firstError(e, 'خطا در دریافت بخشنامه‌ها')); });
    return () => { cancelled = true; };
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUlid, setEditingUlid] = useState<string | null>(null);

  // New announcement form — importance and expiry are the backend's fields.
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newImportance, setNewImportance] = useState<'info' | 'important' | 'urgent'>('important');
  const [newExpiresAt, setNewExpiresAt] = useState('');
  const [publishing, setPublishing] = useState(false);

  const openCreate = () => {
    setEditingUlid(null);
    setNewTitle('');
    setNewContent('');
    setNewImportance('important');
    setNewExpiresAt('');
    setIsCreateModalOpen(true);
  };

  const openEdit = (ann: Announcement) => {
    setEditingUlid(ann.id);
    setNewTitle(ann.title);
    setNewContent(ann.content);
    setNewImportance(ann.category === 'urgent' ? 'urgent' : ann.category === 'official' ? 'important' : 'info');
    setNewExpiresAt(ann.expiresAt ?? '');
    setIsCreateModalOpen(true);
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    setPublishing(true);
    setError(null);
    try {
      if (editingUlid) {
        await ApiAnnouncementService.update(editingUlid, {
          title: newTitle.trim(),
          body: newContent.trim(),
          importance: newImportance,
          expiresAt: newExpiresAt || null,
        });
      } else {
        await ApiAnnouncementService.create(
          newTitle.trim(),
          newContent.trim(),
          newImportance,
          newExpiresAt || undefined,
        );
      }

      const rows = await ApiAnnouncementService.list();
      setAnnouncements(rows);
      setIsCreateModalOpen(false);
      setEditingUlid(null);
      setNewTitle('');
      setNewContent('');
      setNewExpiresAt('');
    } catch (err) {
      setError(firstError(err, editingUlid ? 'خطا در ویرایش اطلاعیه' : 'خطا در انتشار اطلاعیه'));
    } finally {
      setPublishing(false);
    }
  };

  const filtered = (announcements ?? []).filter((a) => {
    if (selectedCategory !== 'all' && a.category !== selectedCategory) return false;
    return true;
  });

  const tabs = [
    { id: 'all', label: 'همه' },
    { id: 'official', label: 'بخشنامه‌های رسمی' },
    { id: 'educational', label: 'اطلاعیه‌های آموزشی' },
    { id: 'urgent', label: 'فوری' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="کانال اطلاع‌رسانی و بخشنامه‌های رسمی دبیرستان"
        subtitle="هر بخشنامه با نام صادرکننده و تاریخ انتشار رسمی ثبت می‌شود و پس از انتشار برای مخاطبانش ابلاغ می‌گردد"
        actions={
          canPublish && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={15} />}
              onClick={openCreate}
            >
              انتشار اطلاعیه جدید
            </Button>
          )
        }
      />

      {error && (
        <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
          <div className="flex items-center gap-2 text-xs text-rose-900 dark:text-rose-200">
            <AlertCircle size={15} />
            <span className="font-bold">{error}</span>
          </div>
        </Card>
      )}

      {/* Categories Bar */}
      <div className="flex items-center gap-1.5 pb-2 border-b border-[#DCE3EE] dark:border-[#344257] overflow-x-auto">
        {tabs.map((tab) => {
          const count = tab.id === 'all'
            ? (announcements?.length ?? 0)
            : (announcements ?? []).filter((a) => a.category === tab.id).length;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap',
                selectedCategory === tab.id
                  ? 'bg-[#2457C5] text-white dark:bg-[#8BAEFF] dark:text-[#101722]'
                  : 'bg-white dark:bg-[#182231] text-[#526176] dark:text-[#B3C0D2] border border-[#DCE3EE] dark:border-[#344257]',
              )}
            >
              {tab.label}
              <span className="opacity-70 tabular-nums mr-1.5">({toPersianDigits(count)})</span>
            </button>
          );
        })}
      </div>

      {/* Announcements Feed */}
      {announcements === null ? (
        <Card>
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#526176] dark:text-[#B3C0D2]">
            <Loader2 size={18} className="animate-spin" /> در حال دریافت کانال رسمی…
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Radio size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
            title="این بخش از کانال خالی است"
            description={
              announcements.length === 0
                ? 'هنوز بخشنامه‌ای در کانال اطلاع‌رسانی رسمی منتشر نشده است؛ نخستین اطلاعیه با دکمهٔ «انتشار اطلاعیه جدید» ثبت می‌شود.'
                : 'در این دسته‌بندی بخشنامه‌ای نیست؛ تب‌های دیگر را ببینید.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((ann) => (
            <Card key={ann.id} className="text-right">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DCE3EE] dark:border-[#344257]">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant={CATEGORY_BADGE[ann.category].variant}>
                    {CATEGORY_BADGE[ann.category].label}
                  </Badge>
                  <h3 className="text-base font-bold text-[#202B3C] dark:text-[#F1F5FB] truncate">{ann.title}</h3>
                </div>

                <div className="flex items-center gap-2 text-xs text-[#526176] dark:text-[#B3C0D2] shrink-0">
                  <Calendar size={13} className="text-[#2457C5]" />
                  <span className="tabular-nums">{ann.publishedDate}</span>
                </div>
              </div>

              <p className="text-xs md:text-sm text-[#526176] dark:text-[#B3C0D2] py-3 leading-relaxed whitespace-pre-line">
                {ann.content}
              </p>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
                <span>صادرکننده: <strong>{ann.authorName}</strong> ({ann.authorRole})</span>
                <div className="flex items-center gap-3">
                  {ann.expiresAt && (
                    <span className="flex items-center gap-1">
                      <Megaphone size={11} />
                      اعتبار تا {formatJalaliDate(ann.expiresAt)}
                    </span>
                  )}
                  {canPublish && (
                    <button
                      type="button"
                      onClick={() => openEdit(ann)}
                      className="flex items-center gap-1 text-[#2457C5] dark:text-[#8BAEFF] hover:underline cursor-pointer"
                    >
                      <Pencil size={11} /> ویرایش
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={editingUlid ? 'ویرایش اطلاعیهٔ رسمی' : 'انتشار اطلاعیه یا بخشنامهٔ رسمی'}
        maxWidth="md"
      >
        <form onSubmit={handleCreateAnnouncement} className="space-y-4 text-right">
          <FormField label="عنوان اطلاعیه" required>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="مثال: دعوت به جلسهٔ مجمع عمومی انجمن اولیا"
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <FormField label="اهمیت و سطح ابلاغ" required>
            <select
              value={newImportance}
              onChange={(e) => setNewImportance(e.target.value as 'info' | 'important' | 'urgent')}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            >
              <option value="info">اطلاعیهٔ آموزشی و رویدادها</option>
              <option value="important">بخشنامهٔ رسمی مدرسه</option>
              <option value="urgent">فوری و اضطراری</option>
            </select>
          </FormField>

          <FormField label="متن کامل اطلاعیه" required>
            <textarea
              rows={5}
              required
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="متن بخشنامه، زمان، مکان و جزئیات مورد نظر..."
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <FormField label="تاریخ اعتبار (اختیاری — پس از این تاریخ اطلاعیه منقضی تلقی می‌شود)">
            <JalaliDatePicker value={newExpiresAt} onChange={setNewExpiresAt} placeholder="تاریخ انقضا" />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsCreateModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" type="submit" icon={editingUlid ? <Pencil size={14} /> : <Send size={14} />} disabled={publishing}>
              {publishing ? 'در حال ذخیره…' : editingUlid ? 'ذخیرهٔ ویرایش' : 'انتشار در کانال رسمی'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
