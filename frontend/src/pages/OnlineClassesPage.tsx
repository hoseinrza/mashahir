import React, { useState, useEffect } from 'react';
import {
  Video, VideoOff, Mic, MicOff, Hand, MessageSquare, Users, FileText,
  Share2, PhoneOff, Calendar, Clock, Plus, Download, CheckCircle2,
  AlertCircle, Sparkles, ChevronRight, Play, Eye, BookOpen,
  Send, Maximize2, Radio, UserCheck, RefreshCw, X, Lock, Unlock,
  ExternalLink, Globe, Wifi, Check, ShieldCheck, ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Modal, FormField, PageHeader, StatusIndicator, AccessDeniedGate } from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import { OnlineClassService, ScheduleService } from '../services';
import { OnlineClassSession, OnlineClassParticipant, OnlineChatMessage, OnlineClassStatus } from '../types';
import { INITIAL_CLASSROOMS } from '../data/mockData';

export const OnlineClassesPage: React.FC = () => {
  const { currentUser, activeRole, hasAccess, switchUser } = useAuth();
  const isTeacher = activeRole.id === 'teacher' || activeRole.group === 'faculty';
  const isAdmin = activeRole.group === 'school_admin' || activeRole.group === 'platform';
  const isFamily = activeRole.group === 'family';
  const isStudent = activeRole.group === 'student';
  const isBusDriver = activeRole.id === 'bus_driver';

  const canManage = !isBusDriver && (isTeacher || isAdmin);
  const canView = !isBusDriver && (hasAccess('online_class:view') || canManage || isFamily || isStudent);

  const [sessions, setSessions] = useState<OnlineClassSession[]>(() => OnlineClassService.getAll());
  const [activeRoomSession, setActiveRoomSession] = useState<OnlineClassSession | null>(null);
  const [externalGatewaySession, setExternalGatewaySession] = useState<OnlineClassSession | null>(null);
  const [attendanceRegisteredNotice, setAttendanceRegisteredNotice] = useState<string | null>(null);

  // Time simulation state for checking session lock/unlock status
  const [simulatedTime, setSimulatedTime] = useState<string>('۱۰:۲۵');
  const [unlockedSessionIds, setUnlockedSessionIds] = useState<string[]>([]);

  // Filter states for sessions hub
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'past' | 'schedule'>('today');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');

  // Interactive Live Classroom States
  const [isMicOn, setIsMicOn] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [activePanel, setActivePanel] = useState<'none' | 'chat' | 'participants' | 'resources'>('chat');
  const [boardMode, setBoardMode] = useState<'camera' | 'presentation' | 'whiteboard'>('presentation');

  // In-room chat messages
  const [chatMessages, setChatMessages] = useState<OnlineChatMessage[]>([
    { id: 'm1', senderId: 'usr_teacher_karimi', senderName: 'مهندس کریمی (معلم)', text: 'سلام به همه دانش‌آموزان عزیز. صدا و تصویر من را شفاف دارید؟', timestamp: '۱۰:۰۲', isTeacher: true },
    { id: 'm2', senderId: 'usr_student_parsa', senderName: 'پارسا رادمنش', text: 'بله استاد، صدا و اسلاید کاملاً واضح است.', timestamp: '۱۰:۰۳' },
    { id: 'm3', senderId: 'usr_std_bardia', senderName: 'بردیا سلطانی', text: 'سلام استاد، در محاسبه دترمینان سوال ۳ یک سوال داشتم.', timestamp: '۱۰:۰۵' },
  ]);
  const [newMessageText, setNewMessageText] = useState('');

  // In-room participant mock list
  const [participants, setParticipants] = useState<OnlineClassParticipant[]>([
    { userId: 'usr_teacher_karimi', fullName: 'مهندس محسن کریمی', role: 'teacher', isMuted: false, isVideoOn: true, hasHandRaised: false, connectionQuality: 'excellent', joinedAt: '۰۹:۵۸' },
    { userId: 'usr_student_parsa', studentId: 'std_parsa', fullName: 'پارسا رادمنش', role: 'student', isMuted: true, isVideoOn: true, hasHandRaised: false, connectionQuality: 'excellent', joinedAt: '۱۰:۰۰' },
    { userId: 'usr_student_arash', studentId: 'std_arash', fullName: 'آرش کریمی', role: 'student', isMuted: true, isVideoOn: true, hasHandRaised: false, connectionQuality: 'good', joinedAt: '۱۰:۰۱' },
    { userId: 'usr_std_bardia', studentId: 'std_bardia', fullName: 'بردیا سلطانی', role: 'student', isMuted: true, isVideoOn: false, hasHandRaised: true, connectionQuality: 'excellent', joinedAt: '۱۰:۰۲' },
    { userId: 'usr_std_sina', studentId: 'std_sina', fullName: 'سینا فرهادی', role: 'student', isMuted: true, isVideoOn: true, hasHandRaised: false, connectionQuality: 'good', joinedAt: '۱۰:۰۳' },
    { userId: 'usr_std_6', studentId: 'std_6', fullName: 'امیرعلی صادقی', role: 'student', isMuted: true, isVideoOn: false, hasHandRaised: false, connectionQuality: 'poor', joinedAt: '۱۰:۰۵' },
  ]);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEndSessionModalOpen, setIsEndSessionModalOpen] = useState(false);
  const [attendanceFinalizedNotice, setAttendanceFinalizedNotice] = useState(false);

  // New Session Form
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('هندسه ۱');
  const [newClassId, setNewClassId] = useState('cls_101');
  const [newDate, setNewDate] = useState('۱۴۰۳/۰۷/۱۶');
  const [newStartTime, setNewStartTime] = useState('۱۰:۰۰');
  const [newEndTime, setNewEndTime] = useState('۱۱:۳۰');
  const [newDescription, setNewDescription] = useState('');
  const [newRecordingEnabled, setNewRecordingEnabled] = useState(true);

  // Timer simulation
  const [sessionTimer, setSessionTimer] = useState('۰۱:۱۴:۲۲');

  if (!canView) {
    return (
      <AccessDeniedGate
        title="عدم دسترسی به سامانه کلاس‌های آنلاین"
        requiredRoleOrPermission="online_class:view (دانش‌آموز، دبیر، اولیا یا کادر مدرسه)"
        reason="مشاهده و شرکت در کلاس‌های آنلاین مستلزم عضویت در کادر آموزشی، دانش‌آموزی یا پیوند والدینی مجاز است."
        currentRoleTitle={activeRole.persianTitle}
        suggestedRoleId="usr_student_parsa"
        suggestedRoleName="پارسا رادمنش (دانش‌آموز)"
        onSwitchUser={switchUser}
      />
    );
  }

  const toEnglishDigits = (str: string) => {
    return str.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776));
  };

  const parseTimeToMinutes = (timeStr: string): number => {
    const en = toEnglishDigits(timeStr || '00:00');
    const parts = en.split(':').map(Number);
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    return 0;
  };

  // Determines whether a session has reached its start time or can be entered
  const isSessionJoinable = (session: OnlineClassSession): boolean => {
    if (unlockedSessionIds.includes(session.id)) return true;
    if (session.status === 'live') return true;
    if (session.status === 'completed' || session.status === 'cancelled') return false;

    const currentMinutes = parseTimeToMinutes(simulatedTime);
    const startMinutes = parseTimeToMinutes(session.startTime);
    const endMinutes = parseTimeToMinutes(session.endTime);

    // Active if within 15 minutes before start until end time
    return currentMinutes >= (startMinutes - 15) && currentMinutes <= endMinutes;
  };

  const getMinutesUntilSession = (session: OnlineClassSession): number => {
    const currentMinutes = parseTimeToMinutes(simulatedTime);
    const startMinutes = parseTimeToMinutes(session.startTime);
    return Math.max(0, startMinutes - currentMinutes);
  };

  const handleSimulateTimeForSession = (session: OnlineClassSession) => {
    setSimulatedTime(session.startTime);
    setUnlockedSessionIds((prev) => Array.from(new Set([...prev, session.id])));
  };

  const handleOpenExternalGateway = (session: OnlineClassSession) => {
    // Automatically register online attendance
    OnlineClassService.recordAttendance({
      classSessionId: session.id,
      studentId: currentUser.id === 'usr_student_parsa' ? 'std_parsa' : currentUser.id,
      studentName: currentUser.fullName,
      studentNumber: currentUser.id === 'usr_student_parsa' ? '۱۰۱۰۵' : '۰۰۱',
      joinTime: simulatedTime,
      durationMinutes: 45,
      status: 'present',
      isFinalized: false,
    });

    setAttendanceRegisteredNotice(
      `ورود شما به کلاس آنلاین در بستر ${
        session.externalPlatform === 'adobe_connect' ? 'ادوبی کانکت' : 'اسکای‌روم'
      } در ساعت ${toPersianDigits(simulatedTime)} ثبت شد و حضور شما در پرونده کلاسی تایید گردید.`
    );
    setExternalGatewaySession(session);
  };

  // Filter sessions
  const liveSession = sessions.find((s) => s.status === 'live');
  const todaySessions = sessions.filter((s) => s.date === '۱۴۰۳/۰۷/۱۵');
  const upcomingSessions = sessions.filter((s) => s.status === 'scheduled');
  const completedSessions = sessions.filter((s) => s.status === 'completed');

  const filteredSessions = sessions.filter((s) => {
    if (selectedClassFilter !== 'all' && s.classroomId !== selectedClassFilter) return false;
    if (activeTab === 'today') return s.date === '۱۴۰۳/۰۷/۱۵';
    if (activeTab === 'upcoming') return s.status === 'scheduled';
    if (activeTab === 'past') return s.status === 'completed';
    return true;
  });

  const sortedSessions = [...filteredSessions].sort((a, b) => {
    return parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime);
  });

  const handleSendMessage = () => {
    if (!newMessageText.trim()) return;
    const msg: OnlineChatMessage = {
      id: `msg_${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.fullName,
      text: newMessageText.trim(),
      timestamp: '۱۰:۲۳',
      isTeacher,
    };
    setChatMessages((prev) => [...prev, msg]);
    setNewMessageText('');
  };

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    const targetClass = INITIAL_CLASSROOMS.find((c) => c.id === newClassId);
    const created = OnlineClassService.createSession(
      {
        classroomId: newClassId,
        className: targetClass?.name || 'کلاس ۱۰۱',
        grade: targetClass?.grade || 'پایه دهم',
        subject: newSubject,
        title: newTitle || `کلاس آنلاین ${newSubject}`,
        description: newDescription,
        teacherId: currentUser.id,
        teacherName: currentUser.fullName,
        date: newDate,
        startTime: newStartTime,
        endTime: newEndTime,
        durationMinutes: 90,
        status: 'scheduled',
        meetingRoomId: `mashahir-${Date.now().toString().slice(-4)}`,
        roomUrl: `https://meet.mashahir.sch.ir/room/${newSubject}-${Date.now().toString().slice(-3)}`,
        isRecordingEnabled: newRecordingEnabled,
        resources: [],
      },
      currentUser.fullName
    );
    setSessions(OnlineClassService.getAll());
    setIsCreateModalOpen(false);
    setNewTitle('');
    setNewDescription('');
  };

  const handleEndClassSession = () => {
    if (!activeRoomSession) return;
    OnlineClassService.updateSession(
      activeRoomSession.id,
      {
        status: 'completed',
        summaryNote: 'جلسه با موفقیت به اتمام رسید. حضور و غیاب هوشمند در پرونده دانش‌آموزان ثبت گردید.',
      },
      currentUser.fullName
    );
    setSessions(OnlineClassService.getAll());
    setIsEndSessionModalOpen(false);
    setActiveRoomSession(null);
    setAttendanceFinalizedNotice(true);
    setTimeout(() => setAttendanceFinalizedNotice(false), 6000);
  };

  // ==========================================
  // RENDER: LIVE VIRTUAL CLASSROOM FULLSCREEN
  // ==========================================
  if (activeRoomSession) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0A0E17] text-slate-100 flex flex-col overflow-hidden font-sans">
        {/* Room Header Topbar */}
        <header className="h-14 bg-[#111726] border-b border-slate-800 px-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex items-center gap-2 text-rose-500 font-bold text-xs bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-md shrink-0">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>پخش زنده</span>
            </div>
            <div className="overflow-hidden">
              <h1 className="text-sm font-bold text-white truncate">{activeRoomSession.title}</h1>
              <p className="text-xs text-slate-400 truncate">
                {activeRoomSession.className} · {activeRoomSession.teacherName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* External Platform Connection Badge */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs">
              <Globe size={13} className="text-blue-400" />
              <span>
                سرویس متصل:{' '}
                {activeRoomSession.externalPlatform === 'adobe_connect'
                  ? 'Adobe Connect'
                  : 'Skyroom Cloud'}
              </span>
            </div>
            {activeRoomSession.roomUrl && (
              <a
                href={activeRoomSession.roomUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden lg:flex items-center gap-1 text-[11px] text-slate-300 hover:text-white bg-slate-800 px-2.5 py-1 rounded transition-colors"
                title="باز کردن در پنجره خارجی"
              >
                <ExternalLink size={12} />
                <span>لینک خارجی</span>
              </a>
            )}

            {/* Session duration timer */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-300 font-mono bg-slate-800/60 px-2.5 py-1 rounded border border-slate-700/50">
              <Clock size={13} className="text-amber-400" />
              <span>{sessionTimer}</span>
            </div>

            {/* Recording status */}
            {isRecording && (
              <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded border border-rose-500/20">
                <Radio size={13} className="animate-pulse" />
                <span className="hidden sm:inline">در حال ضبط ابر</span>
              </div>
            )}

            {/* Exit / End button */}
            {canManage ? (
              <button
                onClick={() => setIsEndSessionModalOpen(true)}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <PhoneOff size={14} />
                <span className="hidden sm:inline">اتمام کلاس برای همه</span>
                <span className="sm:hidden">اتمام</span>
              </button>
            ) : (
              <button
                onClick={() => setActiveRoomSession(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <PhoneOff size={14} />
                <span>خروج از جلسه</span>
              </button>
            )}
          </div>
        </header>

        {/* Room Main Body: Stage + Side Panel */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Main Stage Video & Board */}
          <main className="flex-1 flex flex-col bg-[#070A11] p-2 sm:p-4 overflow-hidden relative">
            {/* View Mode Switcher on Stage */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-1 bg-[#151D2E]/80 backdrop-blur border border-slate-700/60 p-1 rounded-lg text-xs">
              <button
                onClick={() => setBoardMode('presentation')}
                className={cn('px-2.5 py-1 rounded transition-colors', boardMode === 'presentation' ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-white')}
              >
                اسلاید و تدریس
              </button>
              <button
                onClick={() => setBoardMode('whiteboard')}
                className={cn('px-2.5 py-1 rounded transition-colors', boardMode === 'whiteboard' ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-white')}
              >
                تخته وایت‌برد
              </button>
              <button
                onClick={() => setBoardMode('camera')}
                className={cn('px-2.5 py-1 rounded transition-colors', boardMode === 'camera' ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-white')}
              >
                دوربین معلم
              </button>
            </div>

            {/* Video / Board Canvas */}
            <div className="flex-1 w-full bg-[#121927] rounded-xl border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl">
              {boardMode === 'presentation' && (
                <div className="w-full h-full p-4 sm:p-8 flex flex-col justify-between bg-gradient-to-b from-[#131C2E] to-[#0E1524]">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <span className="text-xs text-blue-400 font-semibold tracking-wider uppercase">
                      {activeRoomSession.subject} · صفحه ۳۴ از ۵۸
                    </span>
                    <span className="text-xs text-slate-500">مشاهیر آینده — اتاق تعاملی ۱</span>
                  </div>

                  {/* Simulated mathematical equation and content */}
                  <div className="my-auto max-w-xl mx-auto text-center space-y-4">
                    <div className="p-4 bg-[#182337] rounded-lg border border-slate-700/70 shadow-inner">
                      <p className="text-xs text-slate-400 mb-2">فرمول محاسبه دترمینان ماتریس مرتبه ۳ × ۳ با بسط ساروس:</p>
                      <div className="font-mono text-base sm:text-xl text-amber-300 font-bold dir-ltr py-2 tracking-wide">
                        det(A) = a₁₁(a₂₂a₃₃ - a₂₃a₃₂) - a₁₂(a₂₁a₃₃ - a₂₃a₃₁) + a₁₃(a₂₁a₃₂ - a₂₂a₃₁)
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      نکته کلیدی: هرگاه در یک ماتریس دو سطر یا دو ستون با یکدیگر متناسب یا یکسان باشند، دترمینان آن بدون نیاز به محاسبه دقیقاً صفر خواهد بود.
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span>اشتراک‌گذاری تصویر فعال</span>
                    </div>
                    <span>ارائه‌دهنده: {activeRoomSession.teacherName}</span>
                  </div>
                </div>
              )}

              {boardMode === 'whiteboard' && (
                <div className="w-full h-full p-6 flex flex-col items-center justify-center bg-[#0d1522]">
                  <div className="border border-dashed border-slate-700 rounded-lg p-8 text-center max-w-md">
                    <Sparkles className="w-10 h-10 text-blue-400 mx-auto mb-3" />
                    <h3 className="text-sm font-bold text-white mb-1">تخته وایت‌برد هوشمند تدریس</h3>
                    <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                      قلم نوری و ابزار ترسیم اشکال هندسی برای دبیر متصل است. دانش‌آموزان به صورت بلادرنگ تغییرات قلم را مشاهده می‌نمایند.
                    </p>
                    <div className="flex items-center justify-center gap-2 text-xs text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-md border border-blue-500/20">
                      <span>وضوح تصویر: 1080p · نرخ به‌روزرسانی: ۶۰ فریم</span>
                    </div>
                  </div>
                </div>
              )}

              {boardMode === 'camera' && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 relative">
                  <div className="w-28 h-28 rounded-full bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center text-white text-3xl font-bold shadow-xl border-4 border-slate-800 mb-4">
                    م‌ک
                  </div>
                  <h3 className="text-base font-bold text-white">{activeRoomSession.teacherName}</h3>
                  <p className="text-xs text-slate-400 mt-1">دوربین دبیر به صورت تمام‌صفحه فعال است</p>
                </div>
              )}

              {/* Floating Teacher PiP Thumbnail in corner */}
              {boardMode !== 'camera' && (
                <div className="absolute bottom-3 right-3 w-32 sm:w-44 h-24 sm:h-32 bg-slate-900/90 rounded-lg border border-slate-700 overflow-hidden shadow-xl z-20 flex flex-col items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-blue-700 text-white font-bold flex items-center justify-center text-xs mb-1">
                    دبیر
                  </div>
                  <span className="text-[11px] font-medium text-slate-200">{activeRoomSession.teacherName}</span>
                  <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/60 px-1.5 py-0.5 rounded text-[10px] text-emerald-400">
                    <Mic size={10} />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Floating Control Bar */}
            <div className="h-16 flex items-center justify-center gap-2 sm:gap-3 pt-3 shrink-0">
              {/* Mic toggle */}
              <button
                onClick={() => setIsMicOn(!isMicOn)}
                className={cn(
                  'w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-md',
                  isMicOn ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-rose-600/90 text-white hover:bg-rose-600'
                )}
                title={isMicOn ? 'قطع میکروفون' : 'وصل میکروفون'}
              >
                {isMicOn ? <Mic size={18} /> : <MicOff size={18} />}
              </button>

              {/* Camera toggle */}
              <button
                onClick={() => setIsVideoOn(!isVideoOn)}
                className={cn(
                  'w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-md',
                  isVideoOn ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-rose-600/90 text-white hover:bg-rose-600'
                )}
                title={isVideoOn ? 'قطع دوربین' : 'روشن کردن دوربین'}
              >
                {isVideoOn ? <Video size={18} /> : <VideoOff size={18} />}
              </button>

              {/* Screen share toggle */}
              {canManage && (
                <button
                  onClick={() => setIsScreenSharing(!isScreenSharing)}
                  className={cn(
                    'w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-md',
                    isScreenSharing ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-700 text-white hover:bg-slate-600'
                  )}
                  title="اشتراک‌گذاری صفحه"
                >
                  <Share2 size={18} />
                </button>
              )}

              {/* Raise hand toggle for students */}
              <button
                onClick={() => setIsHandRaised(!isHandRaised)}
                className={cn(
                  'w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-md',
                  isHandRaised ? 'bg-amber-500 text-white ring-2 ring-amber-300' : 'bg-slate-700 text-white hover:bg-slate-600'
                )}
                title="بالا بردن دست برای صحبت"
              >
                <Hand size={18} />
              </button>

              {/* Recording toggle for teachers */}
              {canManage && (
                <button
                  onClick={() => setIsRecording(!isRecording)}
                  className={cn(
                    'w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-md',
                    isRecording ? 'bg-rose-600 text-white ring-2 ring-rose-400' : 'bg-slate-700 text-white hover:bg-slate-600'
                  )}
                  title={isRecording ? 'توقف ضبط کلاس' : 'شروع ضبط کلاس'}
                >
                  <Radio size={18} />
                </button>
              )}

              <div className="w-px h-6 bg-slate-700 mx-1" />

              {/* Panel Toggles */}
              <button
                onClick={() => setActivePanel(activePanel === 'chat' ? 'none' : 'chat')}
                className={cn(
                  'w-11 h-11 rounded-full flex items-center justify-center transition-all relative',
                  activePanel === 'chat' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                )}
                title="گفت‌وگوی متنی"
              >
                <MessageSquare size={18} />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full text-[10px] flex items-center justify-center font-bold">
                  {chatMessages.length}
                </span>
              </button>

              <button
                onClick={() => setActivePanel(activePanel === 'participants' ? 'none' : 'participants')}
                className={cn(
                  'w-11 h-11 rounded-full flex items-center justify-center transition-all relative',
                  activePanel === 'participants' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                )}
                title="فهرست حاضرین"
              >
                <Users size={18} />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full text-[10px] flex items-center justify-center font-bold">
                  {participants.length}
                </span>
              </button>

              <button
                onClick={() => setActivePanel(activePanel === 'resources' ? 'none' : 'resources')}
                className={cn(
                  'w-11 h-11 rounded-full flex items-center justify-center transition-all',
                  activePanel === 'resources' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                )}
                title="فایل‌ها و جزوات"
              >
                <FileText size={18} />
              </button>
            </div>
          </main>

          {/* Right Side Panel (Chat / Participants / Resources) */}
          {activePanel !== 'none' && (
            <aside className="w-full sm:w-80 md:w-96 bg-[#111726] border-r border-slate-800 flex flex-col shrink-0 absolute inset-y-0 right-0 sm:relative z-30 shadow-2xl">
              {/* Panel Header */}
              <div className="h-12 border-b border-slate-800 px-4 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">
                  {activePanel === 'chat' && 'گفت‌وگوی زنده کلاس'}
                  {activePanel === 'participants' && `شرکت‌کنندگان حاضر (${participants.length} نفر)`}
                  {activePanel === 'resources' && 'فایل‌ها و پیوست‌های آموزشی'}
                </span>
                <button
                  onClick={() => setActivePanel('none')}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {/* 1. CHAT PANEL */}
                {activePanel === 'chat' && (
                  <div className="flex flex-col h-full justify-between">
                    <div className="space-y-3 overflow-y-auto pr-1">
                      {chatMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            'p-2.5 rounded-lg text-xs leading-relaxed',
                            msg.isTeacher
                              ? 'bg-blue-900/30 border border-blue-700/50 text-blue-100'
                              : 'bg-slate-800/80 border border-slate-700/60 text-slate-200'
                          )}
                        >
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className={cn('font-bold', msg.isTeacher ? 'text-blue-400' : 'text-slate-300')}>
                              {msg.senderName}
                            </span>
                            <span className="text-slate-500 font-mono">{msg.timestamp}</span>
                          </div>
                          <p>{msg.text}</p>
                        </div>
                      ))}
                    </div>

                    {/* Chat Input */}
                    <div className="pt-2 border-t border-slate-800 mt-2 flex gap-2">
                      <input
                        type="text"
                        value={newMessageText}
                        onChange={(e) => setNewMessageText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="پیام خود را بنویسید..."
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={handleSendMessage}
                        className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"
                      >
                        <Send size={15} />
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. PARTICIPANTS PANEL */}
                {activePanel === 'participants' && (
                  <div className="space-y-2">
                    {canManage && (
                      <div className="p-2.5 bg-blue-950/40 border border-blue-800/50 rounded-lg mb-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-blue-300 font-medium">مدیریت صوتی شرکت‌کنندگان</span>
                          <button
                            onClick={() => {
                              setParticipants((prev) =>
                                prev.map((p) => (p.role === 'teacher' ? p : { ...p, isMuted: true }))
                              );
                            }}
                            className="text-[11px] text-rose-400 hover:underline font-bold"
                          >
                            بستن میکروفون همه
                          </button>
                        </div>
                      </div>
                    )}

                    {participants.map((p) => (
                      <div
                        key={p.userId}
                        className="p-2.5 bg-slate-800/70 rounded-lg border border-slate-700/60 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0">
                            {p.fullName.slice(0, 1)}
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-xs font-bold text-slate-200 truncate">{p.fullName}</p>
                            <p className="text-[10px] text-slate-400">
                              {p.role === 'teacher' ? 'دبیر کلاس' : 'دانش‌آموز'} · ورود: {p.joinedAt}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {p.hasHandRaised && (
                            <span className="text-amber-400 p-1 bg-amber-400/10 rounded" title="دست بلند کرده است">
                              <Hand size={14} />
                            </span>
                          )}
                          <span className={cn('p-1 rounded text-xs', p.isMuted ? 'text-rose-400' : 'text-emerald-400')}>
                            {p.isMuted ? <MicOff size={13} /> : <Mic size={13} />}
                          </span>
                          <span className={cn('p-1 rounded text-xs', p.isVideoOn ? 'text-emerald-400' : 'text-slate-500')}>
                            {p.isVideoOn ? <Video size={13} /> : <VideoOff size={13} />}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. RESOURCES PANEL */}
                {activePanel === 'resources' && (
                  <div className="space-y-3">
                    <div className="text-xs text-slate-400 leading-relaxed mb-2">
                      فایل‌ها و جزوات منتشر شده توسط دبیر برای این جلسه:
                    </div>
                    {activeRoomSession.resources && activeRoomSession.resources.length > 0 ? (
                      activeRoomSession.resources.map((res) => (
                        <div
                          key={res.id}
                          className="p-3 bg-slate-800/80 rounded-lg border border-slate-700 flex items-center justify-between gap-3"
                        >
                          <div className="overflow-hidden">
                            <p className="text-xs font-bold text-slate-200 truncate">{res.title}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              حجم: {res.fileSize} · بارگذاری: {res.uploadedAt}
                            </p>
                          </div>
                          <a
                            href={res.fileUrl}
                            download
                            className="bg-blue-600/80 hover:bg-blue-600 text-white p-2 rounded-md transition-colors shrink-0"
                            title="دانلود فایل"
                          >
                            <Download size={14} />
                          </a>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 text-center py-4">فایلی برای این جلسه پیوست نشده است.</p>
                    )}
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>

        {/* Modal Confirm End Session */}
        <Modal
          isOpen={isEndSessionModalOpen}
          onClose={() => setIsEndSessionModalOpen(false)}
          title="تأیید پایان جلسه کلاس آنلاین"
        >
          <div className="space-y-4 text-slate-700 dark:text-slate-300">
            <p className="text-sm">
              آیا از پایان دادن قطعی به جلسه «{activeRoomSession.title}» اطمینان دارید؟
            </p>
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-3 rounded-lg text-xs space-y-1 text-amber-800 dark:text-amber-300">
              <p className="font-bold">همگام‌سازی حضور و غیاب:</p>
              <p>با اتمام جلسه، مدت حضور {participants.length} نفر از شرکت‌کنندگان به طور خودکار در دفتر حضور و غیاب مدرسه ثبت و برای اولیا قابل رویت خواهد بود.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setIsEndSessionModalOpen(false)}>
                انصراف و ادامه کلاس
              </Button>
              <Button variant="danger" onClick={handleEndClassSession}>
                تأیید و پایان دادن به کلاس
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // ==========================================
  // RENDER: MAIN SESSIONS HUB (LOBBY & SCHEDULE)
  // ==========================================
  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 py-2">
      {/* Attendance Finalized Alert Notice */}
      {attendanceFinalizedNotice && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
            <span>کلاس با موفقیت پایان یافت و گزارش حضور و غیاب آنلاین در سیستم ثبت گردید.</span>
          </div>
          <button onClick={() => setAttendanceFinalizedNotice(false)} className="text-emerald-600 hover:underline">
            بستن
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Video className="text-blue-600 dark:text-blue-400" size={24} />
            سامانه کلاس‌های آنلاین و جلسات زنده
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            برگزاری زنده جلسات درسی، اتاق تعاملی، تخته هوشمند و حضور و غیاب یکپارچه مدرسه مشاهیر آینده
          </p>
        </div>

        {canManage && (
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shrink-0"
          >
            <Plus size={16} />
            <span>برنامه‌ریزی کلاس آنلاین جدید</span>
          </Button>
        )}
      </div>

      {/* Attendance Registered Success Notice */}
      {attendanceRegisteredNotice && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{attendanceRegisteredNotice}</span>
          </div>
          <button onClick={() => setAttendanceRegisteredNotice(null)} className="text-emerald-600 hover:underline">
            بستن
          </button>
        </div>
      )}

      {/* MOBILE-FIRST HERO: LIVE ACTIVE SESSION BANNER */}
      {liveSession && (
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl border border-blue-800/60 p-5 sm:p-7 text-white shadow-xl">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  هم‌اکنون در حال برگزاری (زمان ورود فعال است)
                </span>
                <span className="text-xs bg-blue-500/20 border border-blue-400/30 text-blue-200 px-2.5 py-0.5 rounded-full">
                  سرویس خارجی: {liveSession.externalPlatform === 'adobe_connect' ? 'ادوبی کانکت (Adobe Connect)' : 'اسکای‌روم (Skyroom)'}
                </span>
                <span className="text-xs text-blue-200">
                  {liveSession.className} · {liveSession.grade}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">{liveSession.title}</h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                {liveSession.description}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
                <span className="flex items-center gap-1">
                  <UserCheck size={14} className="text-blue-400" />
                  دبیر: {liveSession.teacherName}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={14} className="text-amber-400" />
                  ساعت برگزاری: {liveSession.startTime} الی {liveSession.endTime}
                </span>
                {liveSession.isRecordingEnabled && (
                  <span className="flex items-center gap-1 text-emerald-300">
                    <Radio size={14} />
                    ضبط خودکار فعال است
                  </span>
                )}
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-3">
              <button
                onClick={() => handleOpenExternalGateway(liveSession)}
                className="w-full sm:w-auto px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-lg hover:shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <ExternalLink size={18} />
                <span>ورود به کلاس آنلاین در سرویس خارجی</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SYSTEM TIME & SESSION TIMER SIMULATOR BAR */}
      <div className="p-3 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-blue-900 dark:text-blue-200 font-medium">
          <Clock size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
          <span>ساعت سیستم جهت احراز فرارسیدن زمان کلاس:</span>
          <span className="font-bold font-mono text-sm bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 text-[#2457C5] dark:text-[#8BAEFF]">
            {toPersianDigits(simulatedTime)}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            (دکمه لاگین/ورود فقط در بازه ساعت رسمی کلاس فعال می‌گردد)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 self-stretch sm:self-auto">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1">تغییر ساعت فرضی برای آزمودن:</span>
          {[
            { label: '۱۰:۲۵ (هندسه)', time: '۱۰:۲۵' },
            { label: '۱۱:۵۰ (زیست)', time: '۱۱:۵۰' },
            { label: '۱۴:۰۵ (فیزیک)', time: '۱۴:۰۵' },
            { label: '۱۶:۰۵ (فارسی)', time: '۱۶:۰۵' },
            { label: '۰۹:۰۰ (پیش از موعد)', time: '۰۹:۰۰' },
          ].map((item) => (
            <button
              key={item.time}
              onClick={() => setSimulatedTime(item.time)}
              className={cn(
                'px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer',
                simulatedTime === item.time
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-400'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('today')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap font-medium',
              activeTab === 'today'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            )}
          >
            جلسات امروز ({toPersianDigits(todaySessions.length)})
          </button>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap font-medium',
              activeTab === 'upcoming'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            )}
          >
            جلسات آینده ({toPersianDigits(upcomingSessions.length)})
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap font-medium',
              activeTab === 'past'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            )}
          >
            آرشیو و ضبط‌ها ({toPersianDigits(completedSessions.length)})
          </button>
        </div>

        {/* Classroom Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">کلاس:</label>
          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="all">همه کلاس‌ها</option>
            {INITIAL_CLASSROOMS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* SESSIONS CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedSessions.map((session) => {
          const isLive = session.status === 'live';
          const isCompleted = session.status === 'completed';
          const joinable = isSessionJoinable(session);
          const minutesRemaining = getMinutesUntilSession(session);
          const platformName = session.externalPlatform === 'adobe_connect' ? 'ادوبی کانکت (Adobe Connect)' : 'اسکای‌روم (Skyroom)';

          return (
            <Card
              key={session.id}
              className={cn(
                'flex flex-col justify-between transition-all hover:border-blue-500/50',
                joinable && 'border-emerald-500/60 dark:border-emerald-500/50 shadow-md ring-1 ring-emerald-500/20',
                isLive && 'border-rose-500/60 dark:border-rose-500/50 shadow-md'
              )}
            >
              <div className="space-y-3">
                {/* Header Status & Subject */}
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-blue-600 dark:text-blue-400">{session.subject}</span>
                  <div className="flex items-center gap-1.5">
                    {joinable ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        ورود فعال است
                      </span>
                    ) : session.status === 'scheduled' ? (
                      <span className="text-amber-700 dark:text-amber-300 font-medium bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60 flex items-center gap-1">
                        <Lock size={11} />
                        قفل تا ساعت {toPersianDigits(session.startTime)}
                      </span>
                    ) : isCompleted ? (
                      <span className="text-slate-600 dark:text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        پایان‌یافته
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">{session.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {session.description}
                  </p>
                </div>

                {/* External Platform & Metadata */}
                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">بستر برگزاری:</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                      <Globe size={12} />
                      {platformName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">کلاس و پایه:</span>
                    <span className="font-medium">{session.className}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">دبیر مدرس:</span>
                    <span className="font-medium">{session.teacherName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">ساعت برگزاری:</span>
                    <span className="font-bold font-mono text-slate-700 dark:text-slate-200">
                      {session.startTime} الی {session.endTime}
                    </span>
                  </div>
                </div>

                {/* Resources Attached */}
                {session.resources && session.resources.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <span className="text-[11px] text-slate-400 block mb-1.5">فایل‌های آموزشی جلسه:</span>
                    <div className="space-y-1">
                      {session.resources.map((res) => (
                        <div
                          key={res.id}
                          className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-800/60 rounded text-[11px]"
                        >
                          <span className="truncate max-w-[200px] text-slate-700 dark:text-slate-300">{res.title}</span>
                          <span className="text-slate-400 font-mono">{res.fileSize}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button: Locked until class time arrives */}
              <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                {isCompleted ? (
                  <div className="w-full flex items-center justify-between text-xs">
                    <span className="text-slate-500">کلاس برگزار گردیده است</span>
                    {session.recordingUrl ? (
                      <button
                        onClick={() => handleOpenExternalGateway(session)}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Eye size={13} />
                        <span>مشاهده ضبط و خلاصه</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">حضور و غیاب نهایی شد</span>
                    )}
                  </div>
                ) : joinable ? (
                  <div className="space-y-1">
                    <button
                      onClick={() => handleOpenExternalGateway(session)}
                      className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md cursor-pointer"
                    >
                      <ExternalLink size={14} />
                      <span>ورود به کلاس آنلاین (سرویس خارجی)</span>
                    </button>
                    <p className="text-[10px] text-center text-emerald-600 dark:text-emerald-400 font-medium">
                      زمان کلاس فرارسیده است · ثبت خودکار حضور و غیاب
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <button
                      disabled
                      className="w-full py-2 px-3 bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-not-allowed border border-slate-200/60 dark:border-slate-700/60"
                      title="ورود پس از فرارسیدن زمان رسمی کلاس فعال می‌گردد"
                    >
                      <Lock size={14} className="text-amber-500" />
                      <span>ورود غیرفعال تا ساعت {toPersianDigits(session.startTime)} ({toPersianDigits(minutesRemaining)} دقیقه مانده)</span>
                    </button>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                      <span>ورود ۱۵ دقیقه قبل از جلسه فعال می‌شود</span>
                      <button
                        onClick={() => handleSimulateTimeForSession(session)}
                        className="text-blue-600 dark:text-blue-400 hover:underline text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                        title="آزمودن فعال‌سازی دکمه ورود با شبیه‌سازی ساعت کلاس"
                      >
                        <span>⚡ شبیه‌سازی ساعت کلاس</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {filteredSessions.length === 0 && (
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <Video className="w-10 h-10 text-slate-400 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">هیچ جلسه آنلاینی در این دسته‌بندی یافت نشد.</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">کلاس‌های جدید از طریق تقویم آموزشی اضافه خواهند شد.</p>
        </div>
      )}

      {/* CREATE NEW ONLINE CLASS MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="برنامه‌ریزی کلاس آنلاین جدید"
      >
        <form onSubmit={handleCreateSession} className="space-y-3.5">
          <FormField label="عنوان جلسه">
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="مثال: حل مسائل تکمیلی مبحث الکتریسیته"
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="درس مربوطه">
              <input
                type="text"
                required
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="مثال: حسابان ۱"
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </FormField>

            <FormField label="کلاس هدف">
              <select
                value={newClassId}
                onChange={(e) => setNewClassId(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                {INITIAL_CLASSROOMS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="تاریخ جلسه">
              <input
                type="text"
                required
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </FormField>
            <FormField label="ساعت شروع">
              <input
                type="text"
                required
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </FormField>
            <FormField label="ساعت پایان">
              <input
                type="text"
                required
                value={newEndTime}
                onChange={(e) => setNewEndTime(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </FormField>
          </div>

          <FormField label="توضیحات و اهداف جلسه">
            <textarea
              rows={2}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="شرح مباحثی که در این جلسه تدریس خواهد شد..."
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </FormField>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="recToggle"
              checked={newRecordingEnabled}
              onChange={(e) => setNewRecordingEnabled(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="recToggle" className="text-xs text-slate-700 dark:text-slate-300">
              ضبط خودکار ابر و انتشار فایل پس از پایان کلاس (مطابق رضایت‌نامه مدرسه)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="secondary" type="button" onClick={() => setIsCreateModalOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">
              ثبت و انتشار در برنامه کلاسی
            </Button>
          </div>
        </form>
      </Modal>

      {/* EXTERNAL SERVICE GATEWAY MODAL */}
      <Modal
        isOpen={!!externalGatewaySession}
        onClose={() => setExternalGatewaySession(null)}
        title={
          externalGatewaySession
            ? `درگاه ورود به کلاس آنلاین: ${
                externalGatewaySession.externalPlatform === 'adobe_connect'
                  ? 'ادوبی کانکت (Adobe Connect)'
                  : 'اسکای‌روم (Skyroom)'
              }`
            : 'ورود به کلاس آنلاین'
        }
        maxWidth="lg"
      >
        {externalGatewaySession && (
          <div className="space-y-4 text-right">
            {/* Header Platform Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    سرور خارجی فعال و برخط
                  </span>
                  <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-blue-200">
                    {externalGatewaySession.externalPlatform === 'adobe_connect'
                      ? 'Adobe Connect Enterprise'
                      : 'Skyroom Cloud WebRTC'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">{externalGatewaySession.title}</h3>
                <p className="text-xs text-slate-200">
                  {externalGatewaySession.subject} · {externalGatewaySession.className} · دبیر: {externalGatewaySession.teacherName}
                </p>
              </div>

              <div className="sm:text-left text-xs bg-white/10 p-2.5 rounded-xl border border-white/10 shrink-0">
                <div className="flex items-center gap-1.5 text-emerald-300 font-mono font-bold">
                  <Wifi size={13} />
                  <span>پینگ: ۲۱ میلی‌ثانیه</span>
                </div>
                <div className="text-[10px] text-slate-300 mt-0.5">پروتکل امن WSS / SSL</div>
              </div>
            </div>

            {/* Attendance Confirmation Notice */}
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
              <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">ثبت خودکار در دفتر حضور و غیاب مدرسه:</strong>
                <span>
                  زمان ورود شما ({toPersianDigits(simulatedTime)}) در پرونده تحصیلی و دفتر حضور و غیاب الکترونیکی ثبت شد و به اطلاع دبیر و اولیا رسید.
                </span>
              </div>
            </div>

            {/* Technical Connection Details */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-2">
                <span className="text-slate-500 dark:text-slate-400">آدرس اختصاصی اتاق سرور:</span>
                <span className="font-mono text-blue-600 dark:text-blue-400 font-medium text-[11px] dir-ltr text-left">
                  {externalGatewaySession.roomUrl || `https://www.skyroom.online/ch/mashahir/${externalGatewaySession.meetingRoomId}`}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-2">
                <span className="text-slate-500 dark:text-slate-400">کاربر احراز هویت شده (SSO):</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {currentUser.fullName} ({activeRole.persianTitle})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">شناسه جلسه / توکن یکتا:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">{externalGatewaySession.meetingRoomId}</span>
              </div>
            </div>

            {/* Launch Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => {
                  const url = externalGatewaySession.roomUrl || 'https://www.skyroom.online';
                  window.open(url, '_blank');
                  setExternalGatewaySession(null);
                }}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <ExternalLink size={17} />
                <span>ورود مستقیم و باز کردن پنجره بستر خارجی ({externalGatewaySession.externalPlatform === 'adobe_connect' ? 'ادوبی کانکت' : 'اسکای‌روم'})</span>
              </button>

              <button
                onClick={() => {
                  setActiveRoomSession(externalGatewaySession);
                  setExternalGatewaySession(null);
                }}
                className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium text-xs rounded-xl transition-colors flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                <Play size={15} />
                <span>مشاهده در محیط تعاملی و شبیه‌ساز کلاس زنده در سامانه (وب‌کم، تخته و چت)</span>
              </button>
            </div>

            <div className="flex justify-end pt-1">
              <Button variant="secondary" size="sm" onClick={() => setExternalGatewaySession(null)}>
                انصراف و بستن
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
