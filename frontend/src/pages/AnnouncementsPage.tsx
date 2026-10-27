import React, { useState } from 'react';
import {
  Megaphone, Pin, Calendar, User, Plus, Filter,
  Bell, CheckCircle2, AlertTriangle, Send
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Modal, FormField, PageHeader } from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import { AnnouncementService } from '../services';
import { Announcement } from '../types';

export const AnnouncementsPage: React.FC = () => {
  const { currentUser, hasAccess } = useAuth();
  const canPublish = hasAccess('announcements:create');

  const [announcements, setAnnouncements] = useState<Announcement[]>(() =>
    AnnouncementService.getAll()
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New announcement form
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<'official' | 'educational' | 'urgent' | 'pta'>('official');
  const [isPinned, setIsPinned] = useState(false);

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newContent) return;

    const created = AnnouncementService.create({
      title: newTitle,
      content: newContent,
      category: newCategory,
      targetAudience: ['all'],
      authorName: currentUser.fullName,
      authorRole: 'مدیریت دبیرستان',
      isPinned,
    });

    setAnnouncements([created, ...announcements]);
    setIsCreateModalOpen(false);
    setNewTitle('');
    setNewContent('');
  };

  const filtered = announcements.filter((a) => {
    if (selectedCategory !== 'all' && a.category !== selectedCategory) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="کانال اطلاع‌رسانی و بخشنامه‌های رسمی دبیرستان"
        subtitle="اطلاعیه‌های آموزشی، تقویم جلسات، برنامه‌های اردویی و رویدادهای مهم مدرسه"
        actions={
          canPublish && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={15} />}
              onClick={() => setIsCreateModalOpen(true)}
            >
              انتشار اطلاعیه جدید
            </Button>
          )
        }
      />

      {/* Categories Bar */}
      <div className="flex items-center gap-1.5 pb-2 border-b border-[#DCE3EE] dark:border-[#344257] overflow-x-auto">
        {[
          { id: 'all', label: 'همه اطلاعیه‌ها' },
          { id: 'official', label: 'بخشنامه‌های رسمی' },
          { id: 'educational', label: 'اطلاعیه‌های آموزشی' },
          { id: 'urgent', label: 'موارد فوری و مهم' },
          { id: 'pta', label: 'انجمن اولیا' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedCategory(tab.id)}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer',
              selectedCategory === tab.id
                ? 'bg-[#2457C5] text-white dark:bg-[#8BAEFF] dark:text-[#101722]'
                : 'bg-white dark:bg-[#182231] text-[#526176] dark:text-[#B3C0D2] border border-[#DCE3EE] dark:border-[#344257]'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Announcements Feed */}
      <div className="space-y-4">
        {filtered.map((ann) => (
          <Card key={ann.id} className="text-right">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DCE3EE] dark:border-[#344257]">
              <div className="flex items-center gap-2">
                {ann.isPinned && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 rounded-md">
                    <Pin size={12} className="rotate-45" />
                    <span>سنجاق‌شده</span>
                  </span>
                )}
                <Badge variant={ann.category === 'urgent' ? 'danger' : ann.category === 'official' ? 'primary' : 'neutral'}>
                  {ann.category === 'urgent' ? 'فوری' : ann.category === 'official' ? 'رسمی' : 'آموزشی'}
                </Badge>
                <h3 className="text-base font-bold text-[#202B3C] dark:text-[#F1F5FB]">{ann.title}</h3>
              </div>

              <div className="flex items-center gap-2 text-xs text-[#526176] dark:text-[#B3C0D2]">
                <Calendar size={13} className="text-[#2457C5]" />
                <span className="font-mono tabular-nums">{ann.publishedDate}</span>
              </div>
            </div>

            <p className="text-xs md:text-sm text-[#526176] dark:text-[#B3C0D2] py-3 leading-relaxed">
              {ann.content}
            </p>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>صادرکننده: <strong>{ann.authorName}</strong> ({ann.authorRole})</span>
              <span>مخاطبان: عموم اولیا و دانش‌آموزان</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="انتشار اطلاعیه یا بخشنامه رسمی"
        maxWidth="md"
      >
        <form onSubmit={handleCreateAnnouncement} className="space-y-4 text-right">
          <FormField label="عنوان اطلاعیه" required>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="مثال: دعوت به جلسه مجمع عمومی انجمن اولیا"
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <FormField label="دسته‌بندی" required>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as any)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            >
              <option value="official">بخشنامه رسمی مدرسه</option>
              <option value="educational">اطلاعیه آموزشی و امتحانات</option>
              <option value="urgent">فوری و اضطراری</option>
              <option value="pta">انجمن اولیا و مربیان</option>
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

          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="rounded"
            />
            <span>سنجاق کردن در بالای فهرست اطلاعیه‌ها (پین)</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsCreateModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" type="submit" icon={<Send size={14} />}>
              انتشار عمومی
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
