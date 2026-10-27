import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, UserPlus, Shield, CheckCircle2, Search, Filter,
  School as SchoolIcon, BookOpen, Clock, ArrowRight, UserCheck,
  Building2, Bus, MapPin, Phone, Mail, Award, Check, Plus,
  ShieldCheck, AlertCircle, Sparkles, UserCog, Briefcase, GraduationCap,
  Car, Compass, FileText, ChevronRight, HeartHandshake, Radio
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Modal, FormField, SearchInput, PageHeader, AccessDeniedGate, RolePermissionBadge } from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import { UserService, SchoolService, BusService, ClassroomService, FamilyService } from '../services';
import { ApiUserService } from '../api/data';
import { User, RoleAssignment, PermissionScope, School, BusRoute, Student, Classroom, GuardianRelationshipType } from '../types';
import { BASE_ROLES } from '../permissions';
import { INITIAL_CLASSROOMS } from '../data/mockData';

export const UserManagementPage: React.FC = () => {
  const { allUsers, allRoles, userAssignments, activeRole, currentUser, hasAccess, switchUser } = useAuth();

  // Role checks according to requirements
  const isPlatformAdmin = activeRole.group === 'platform' || activeRole.id === 'platform_super_admin' || currentUser.id === 'usr_platform_admin';
  const isPrincipal = activeRole.id === 'school_principal' || currentUser.id === 'usr_principal';
  const isEduDeputy = activeRole.id === 'educational_deputy' || currentUser.id === 'usr_edu_deputy';
  const isDisciplinaryDeputy = activeRole.id === 'disciplinary_deputy' || activeRole.id === 'attendance_supervisor' || currentUser.id === 'usr_disciplinary_deputy' || currentUser.id === 'usr_nazem';

  const isAuthorized = isPlatformAdmin || isPrincipal || isEduDeputy || isDisciplinaryDeputy || hasAccess('users:manage') || hasAccess('classes:manage');

  // Initial tab depending on the role
  const defaultTab = isPlatformAdmin ? 'schools' : isEduDeputy ? 'teachers' : isDisciplinaryDeputy ? 'transport' : 'staff';
  const [activeTab, setActiveTab] = useState<'schools' | 'staff' | 'teachers' | 'classrooms' | 'students' | 'transport' | 'all_users'>(defaultTab);

  // States
  const [schools, setSchools] = useState<School[]>(() => SchoolService.getAll());
  const [users, setUsers] = useState<User[]>(() => UserService.getUsers());
  const [students, setStudents] = useState<Student[]>(() => UserService.getStudents());
  const [classrooms, setClassrooms] = useState<Classroom[]>(() => ClassroomService.getAll());
  const [busRoutes, setBusRoutes] = useState<BusRoute[]>(() => BusService.getRoutes());
  const [assignments, setAssignments] = useState<RoleAssignment[]>(() => UserService.getRoleAssignments());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLiveUsers, setIsLiveUsers] = useState(false);

  // Real user/student rosters from the backend; mock data stays as fallback.
  useEffect(() => {
    if (!isAuthorized) return;
    let cancelled = false;
    Promise.all([ApiUserService.listUsers(), ApiUserService.listStudents()])
      .then(([apiUsers, apiStudents]) => {
        if (cancelled) return;
        if (apiUsers.length > 0) {
          setUsers(apiUsers);
          setIsLiveUsers(true);
        }
        if (apiStudents.length > 0) setStudents(apiStudents);
      })
      .catch(() => { /* keep demo data when the API is unreachable */ });
    return () => { cancelled = true; };
  }, [isAuthorized]);

  // Modals
  const [isCreateSchoolModalOpen, setIsCreateSchoolModalOpen] = useState(false);
  const [isAssignPrincipalsModalOpen, setIsAssignPrincipalsModalOpen] = useState(false);
  const [selectedSchoolForPrincipals, setSelectedSchoolForPrincipals] = useState<School | null>(null);
  const [isCreateStaffModalOpen, setIsCreateStaffModalOpen] = useState(false);
  const [isCreateTeacherModalOpen, setIsCreateTeacherModalOpen] = useState(false);
  const [isCreateStudentModalOpen, setIsCreateStudentModalOpen] = useState(false);
  const [isCreateRouteModalOpen, setIsCreateRouteModalOpen] = useState(false);
  const [isCreateDriverModalOpen, setIsCreateDriverModalOpen] = useState(false);
  const [isAssignRoleModalOpen, setIsAssignRoleModalOpen] = useState(false);

  // Success Notice Toast
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const showNotice = (msg: string) => {
    setNoticeMessage(msg);
    setTimeout(() => setNoticeMessage(null), 5000);
  };

  // Form: Create School (Platform Admin)
  const [schoolName, setSchoolName] = useState('');
  const [schoolBranch, setSchoolBranch] = useState('دوره دوم متوسطه');
  const [schoolCode, setSchoolCode] = useState('۹۵۸۲' + Math.floor(1000 + Math.random() * 9000));
  const [schoolPrincipal1, setSchoolPrincipal1] = useState('دکتر احمدرضا جلالی');
  const [schoolPrincipal2, setSchoolPrincipal2] = useState('مهندس کامران رضایی');
  const [schoolAddress, setSchoolAddress] = useState('تهران، منطقه ۱');
  const [schoolPhone, setSchoolPhone] = useState('۰۲۱-۲۲' + Math.floor(100000 + Math.random() * 900000));
  const [schoolCapacity, setSchoolCapacity] = useState(300);

  // Form: Assign Multi-Principals
  const [selectedCoPrincipals, setSelectedCoPrincipals] = useState<string[]>([]);
  const [newPrincipalNameInput, setNewPrincipalNameInput] = useState('');

  // Form: Create Staff (Principal - Full Access)
  const [staffFullName, setStaffFullName] = useState('');
  const [staffNationalId, setStaffNationalId] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState('educational_deputy');

  // Form: Create Teacher (Educational Deputy / Principal)
  const [teacherName, setTeacherName] = useState('');
  const [teacherNationalId, setTeacherNationalId] = useState('');
  const [teacherPhone, setTeacherPhone] = useState('');
  const [teacherSubject, setTeacherSubject] = useState('ریاضیات و حسابان');
  const [teacherClassId, setTeacherClassId] = useState('cls_101');

  // Form: Create Student (Educational Deputy / Principal)
  const [studentName, setStudentName] = useState('');
  const [studentNationalId, setStudentNationalId] = useState('');
  const [studentCode, setStudentCode] = useState('۱۰' + Math.floor(100 + Math.random() * 900));
  const [studentClassId, setStudentClassId] = useState('cls_101');
  const [studentGender, setStudentGender] = useState<'male' | 'female'>('male');
  const [studentGuardianName, setStudentGuardianName] = useState('');
  const [studentGuardianPhone, setStudentGuardianPhone] = useState('');
  const [studentGuardianRelation, setStudentGuardianRelation] = useState<GuardianRelationshipType>('father');
  const [studentGuardianNationalId, setStudentGuardianNationalId] = useState('');

  // Form: Create Classroom
  const [isCreateClassModalOpen, setIsCreateClassModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('پایه دهم');
  const [newClassField, setNewClassField] = useState('ریاضی و فیزیک');
  const [newClassRoom, setNewClassRoom] = useState('۱۰۱');
  const [newClassCapacity, setNewClassCapacity] = useState(26);
  const [newClassHeadTeacherId, setNewClassHeadTeacherId] = useState('usr_teacher_karimi');

  // Form: Create Bus Route (Disciplinary Deputy / Principal)
  const [routeLineCode, setRouteLineCode] = useState('خط ۴');
  const [routeTitle, setRouteTitle] = useState('مسیر پاسداران - هروی - اختیاریه');
  const [routeDriverName, setRouteDriverName] = useState('صادق اکبری');
  const [routeDriverPhone, setRouteDriverPhone] = useState('۰۹۱۲' + Math.floor(1000000 + Math.random() * 9000000));
  const [routeVehicle, setRouteVehicle] = useState('ون تویوتا هایس');
  const [routePlate, setRoutePlate] = useState('۴۲ ق ۷۸۹ ایران ۳۳');
  const [routeCapacity, setRouteCapacity] = useState(14);
  const [routeStopsText, setRouteStopsText] = useState('میدان هروی، خیابان اختیاریه، چهارراه پاسداران، مدرسه');

  // Form: Assign Role
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || '');
  const [selectedRoleId, setSelectedRoleId] = useState(allRoles[0]?.id || 'teacher');
  const [selectedScope, setSelectedScope] = useState<PermissionScope>('school');
  const [scopeClassId, setScopeClassId] = useState('cls_101');

  if (!isAuthorized) {
    return (
      <AccessDeniedGate
        title="دسترسی به بخش مدیریت واحد آموزشی و کاربران"
        requiredRoleOrPermission="مدیر کل پلتفرم، مدیر مدرسه یا معاونین آموزشی و انضباطی"
        reason="تعریف مدارس، استخدام کادر، ثبت‌نام دانش‌آموزان و مدیریت رانندگان سرویس منحصراً در صلاحیت مدیران ارشد و معاونت‌های مربوطه است."
        currentRoleTitle={activeRole.persianTitle}
        suggestedRoleId="usr_principal"
        suggestedRoleName="دکتر احمدرضا جلالی (مدیر مدرسه)"
        onSwitchUser={switchUser}
      />
    );
  }

  // Submit: Create School
  const handleCreateSchool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName.trim()) return;

    const principalsList = [schoolPrincipal1.trim()];
    if (schoolPrincipal2.trim()) principalsList.push(schoolPrincipal2.trim());

    const created = SchoolService.createSchool(
      {
        name: schoolName,
        branch: schoolBranch,
        code: schoolCode,
        academicYear: '۱۴۰۳-۱۴۰۴',
        principalName: principalsList[0],
        coPrincipals: principalsList,
        address: schoolAddress,
        phone: schoolPhone,
        capacity: schoolCapacity,
      },
      currentUser.fullName
    );

    setSchools(SchoolService.getAll());
    setIsCreateSchoolModalOpen(false);
    showNotice(`مدرسه جدید «${created.name}» با موفقیت تأسیس و مدیران منصوب شدند.`);
    setSchoolName('');
  };

  // Submit: Assign Multi-Principals
  const handleSavePrincipals = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchoolForPrincipals) return;

    const updatedList = SchoolService.assignPrincipals(
      selectedSchoolForPrincipals.id,
      selectedCoPrincipals,
      currentUser.fullName
    );
    setSchools(updatedList);
    setIsAssignPrincipalsModalOpen(false);
    showNotice(`فهرست مدیران مدرسه «${selectedSchoolForPrincipals.name}» با موفقیت به‌روزرسانی شد.`);
  };

  // Submit: Create Staff
  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffFullName.trim()) return;

    const newUser = UserService.createUser(
      {
        nationalId: staffNationalId || '۰۰' + Math.floor(10000000 + Math.random() * 90000000),
        fullName: staffFullName,
        phoneNumber: staffPhone || '۰۹۱۲۰۰۰۰۰۰۰',
        email: staffEmail || 'staff@mashahir.sch.ir',
        isActive: true,
      },
      currentUser.fullName
    );

    // Assign Role Assignment
    UserService.assignRole({
      userId: newUser.id,
      roleId: staffRole,
      schoolId: 'sch_1',
      scopeType: 'school',
      scopeId: '*',
      validFrom: '۱۴۰۳/۰۷/۰۱',
    });

    setUsers(UserService.getUsers());
    setAssignments(UserService.getRoleAssignments());
    setIsCreateStaffModalOpen(false);
    showNotice(`کاربر کادر «${newUser.fullName}» با موفقیت ایجاد و دسترسی‌های لازم فعال گردید.`);
    setStaffFullName('');
  };

  // Submit: Create Teacher
  const handleCreateTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherName.trim()) return;

    const newTeacher = UserService.createUser(
      {
        nationalId: teacherNationalId || '۰۰' + Math.floor(10000000 + Math.random() * 90000000),
        fullName: teacherName,
        phoneNumber: teacherPhone || '۰۹۱۲۰۰۰۰۰۰۰',
        email: `teacher_${Date.now()}@mashahir.sch.ir`,
        isActive: true,
      },
      currentUser.fullName
    );

    UserService.assignRole({
      userId: newTeacher.id,
      roleId: 'teacher',
      schoolId: 'sch_1',
      scopeType: 'classroom',
      scopeId: teacherClassId,
      validFrom: '۱۴۰۳/۰۷/۰۱',
    });

    setUsers(UserService.getUsers());
    setAssignments(UserService.getRoleAssignments());
    setIsCreateTeacherModalOpen(false);
    showNotice(`دبیر جدید «${newTeacher.fullName}» برای تدریس درس ${teacherSubject} اضافه گردید.`);
    setTeacherName('');
  };

  // Submit: Create Classroom
  const handleCreateClassroom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    const teacher = users.find((u) => u.id === newClassHeadTeacherId);
    const created = ClassroomService.createClassroom(
      {
        schoolId: schools[0]?.id || 'sch_1',
        name: newClassName.trim(),
        grade: newClassGrade,
        field: newClassField,
        roomNumber: newClassRoom.trim() || '۱۰۱',
        capacity: newClassCapacity || 25,
        headTeacherId: newClassHeadTeacherId,
        studentCount: 0,
      },
      currentUser.fullName
    );

    setClassrooms(ClassroomService.getAll());
    setIsCreateClassModalOpen(false);
    showNotice(`کلاس «${created.name}» با موفقیت ثبت شد و ${teacher ? teacher.fullName : 'دبیر'} به عنوان دبیر راهنما منتسب گردید.`);
    setNewClassName('');
    setNewClassRoom('');
  };

  // Submit: Create Student
  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) return;

    const cls = classrooms.find((c) => c.id === studentClassId) || INITIAL_CLASSROOMS[0];

    const newStudent = UserService.createStudent(
      {
        studentNumber: studentCode,
        classroomId: studentClassId,
        nationalId: studentNationalId || '۰۰' + Math.floor(10000000 + Math.random() * 90000000),
        fullName: studentName,
        gender: studentGender,
        birthDate: '۱۳۸۷/۰۵/۱۵',
        enrollmentStatus: 'active',
      },
      currentUser.fullName
    );

    // If guardian information is provided, create and link parent user
    if (studentGuardianName.trim()) {
      FamilyService.createGuardianAndLink(
        {
          guardianName: studentGuardianName.trim(),
          guardianNationalId: studentGuardianNationalId.trim() || '۰۰' + Math.floor(10000000 + Math.random() * 90000000),
          guardianPhone: studentGuardianPhone.trim() || '۰۹۱۲۰۰۰۰۰۰۰',
          studentId: newStudent.id,
          studentName: newStudent.fullName,
          relationshipType: studentGuardianRelation,
          canViewAcademicReport: true,
          canViewAttendance: true,
          canReceiveSmsNotifications: true,
          canSignConsentForms: true,
          canPickupStudent: true,
          notes: 'ثبت در زمان پذیرش دانش‌آموز در واحد آموزشی',
        },
        currentUser.fullName
      );
    }

    setStudents(UserService.getStudents());
    setUsers(UserService.getUsers());
    setIsCreateStudentModalOpen(false);
    showNotice(`دانش‌آموز «${newStudent.fullName}» با موفقیت در ${cls.name} ثبت‌نام شد${studentGuardianName.trim() ? ' و حساب اولیا متصل گردید' : ''}.`);
    setStudentName('');
    setStudentGuardianName('');
    setStudentGuardianNationalId('');
    setStudentGuardianPhone('');
  };

  // Submit: Create Route
  const handleCreateRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeTitle.trim() || !routeDriverName.trim()) return;

    const stops = routeStopsText.split('،').map((s) => s.trim()).filter(Boolean);

    const createdRoute = BusService.createRoute(
      {
        schoolId: 'sch_1',
        lineCode: routeLineCode,
        title: routeTitle,
        driverName: routeDriverName,
        driverPhone: routeDriverPhone,
        driverNationalId: '۰۰' + Math.floor(10000000 + Math.random() * 90000000),
        vehicleModel: routeVehicle,
        plateNumber: routePlate,
        capacity: routeCapacity,
        assignedStudentCount: 0,
        stops: stops.length > 0 ? stops : ['میدان کاج', 'میدان ونک', 'مدرسه'],
        morningDepartureTime: '۰۶:۴۵',
        eveningDepartureTime: '۱۵:۰۰',
        isActive: true,
      },
      currentUser.fullName
    );

    setBusRoutes(BusService.getRoutes());
    setIsCreateRouteModalOpen(false);
    showNotice(`خط سرویس «${createdRoute.lineCode} (${createdRoute.title})» به رانندگی ${createdRoute.driverName} با موفقیت ثبت شد.`);
    setRouteTitle('');
  };

  // Submit: Assign Role
  const handleAssignRole = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = UserService.assignRole({
      userId: selectedUserId,
      roleId: selectedRoleId,
      schoolId: 'sch_1',
      scopeType: selectedScope,
      scopeId: selectedScope === 'classroom' ? scopeClassId : '*',
      validFrom: '۱۴۰۳/۰۷/۰۱',
    });
    setAssignments(updated);
    setIsAssignRoleModalOpen(false);
    showNotice('نقش و قلمرو جدید با موفقیت به کاربر منتسب شد.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="مدیریت مدارس، کادر آموزشی، دانش‌آموزان و ناوگان سرویس"
        subtitle="سامانه جامع تفکیک اختیارات قانونی: تعریف مدارس، چندمدیره بودن، جذب کادر، ثبت‌نام و مدیریت خطوط سرویس"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isPlatformAdmin && (
              <Button
                variant="primary"
                size="sm"
                icon={<Building2 size={15} />}
                onClick={() => setIsCreateSchoolModalOpen(true)}
              >
                تأسیس مدرسه جدید
              </Button>
            )}
            {isPrincipal && (
              <Button
                variant="primary"
                size="sm"
                icon={<Briefcase size={15} />}
                onClick={() => setIsCreateStaffModalOpen(true)}
              >
                افزودن عضو کادر اداری
              </Button>
            )}
            {(isPrincipal || isEduDeputy) && (
              <Button
                variant="outline"
                size="sm"
                icon={<GraduationCap size={15} />}
                onClick={() => setIsCreateStudentModalOpen(true)}
              >
                ثبت‌نام دانش‌آموز
              </Button>
            )}
            {(isPrincipal || isDisciplinaryDeputy) && (
              <Button
                variant="outline"
                size="sm"
                icon={<Bus size={15} />}
                onClick={() => setIsCreateRouteModalOpen(true)}
              >
                تعریف خط سرویس جدید
              </Button>
            )}
          </div>
        }
      />

      {/* Notice Banner */}
      {noticeMessage && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{noticeMessage}</span>
          </div>
          <button onClick={() => setNoticeMessage(null)} className="text-emerald-600 hover:underline">
            بستن
          </button>
        </div>
      )}

      {/* Role Power Badge Indicator */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <ShieldCheck size={20} className="text-[#2457C5] dark:text-[#8BAEFF] shrink-0" />
          <div>
            <strong className="block text-slate-900 dark:text-slate-100 font-bold">
              سطح اختیارات شما در این پنل: {activeRole.persianTitle} ({currentUser.fullName})
            </strong>
            <span className="text-slate-500 dark:text-slate-400">
              {isPlatformAdmin
                ? 'دسترسی کلان پلتفرم: امکان تعریف مدارس و تعیین چند مدیر برای هر مدرسه بدون هیچ‌گونه محدودیت عددی.'
                : isPrincipal
                ? 'دسترسی کامل (Full Access): تعریف کادر اداری و آموزشی، تغییر نقش‌ها و انتساب اختیارات.'
                : isEduDeputy
                ? 'معاونت آموزشی: مجاز به افزودن معلمان و ثبت‌نام دانش‌آموزان در کلاس‌ها.'
                : isDisciplinaryDeputy
                ? 'معاونت انضباطی: مجاز به مدیریت سامانه سرویس‌ها، تعریف رانندگان، خطوط و مسیرهای رفت و برگشت.'
                : 'دسترسی مشاهده‌ای و مدیریتی کلاس'}
            </span>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <RolePermissionBadge level={isPrincipal || isPlatformAdmin ? 'full' : 'special'} scopeLabel="پلتفرم و مدرسه" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('schools')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer',
            activeTab === 'schools'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          )}
        >
          <Building2 size={14} />
          <span>مدارس و مدیران ({toPersianDigits(schools.length)})</span>
        </button>

        <button
          onClick={() => setActiveTab('staff')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer',
            activeTab === 'staff'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          )}
        >
          <Briefcase size={14} />
          <span>کادر اداری و معاونین</span>
        </button>

        <button
          onClick={() => setActiveTab('teachers')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer',
            activeTab === 'teachers'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          )}
        >
          <BookOpen size={14} />
          <span>معلمان و مدرسان</span>
        </button>

        <button
          onClick={() => setActiveTab('classrooms')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer',
            activeTab === 'classrooms'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          )}
        >
          <BookOpen size={14} />
          <span>کلاس‌های درس ({toPersianDigits(classrooms.length)})</span>
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer',
            activeTab === 'students'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          )}
        >
          <GraduationCap size={14} />
          <span>دانش‌آموزان ({toPersianDigits(students.length)})</span>
        </button>

        <button
          onClick={() => setActiveTab('transport')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer',
            activeTab === 'transport'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          )}
        >
          <Bus size={14} />
          <span>سامانه سرویس‌ها و رانندگان ({toPersianDigits(busRoutes.length)})</span>
        </button>

        <button
          onClick={() => setActiveTab('all_users')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer',
            activeTab === 'all_users'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          )}
        >
          <Users size={14} />
          <span>ماتریس جامع کاربران و RBAC</span>
        </button>
      </div>

      {/* TAB 1: SCHOOLS & MULTI-PRINCIPAL MANAGEMENT */}
      {activeTab === 'schools' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-2xl text-xs text-blue-900 dark:text-blue-200">
            <div>
              <strong className="block font-bold">قابلیت تعریف چند مدیر برای هر مدرسه (Multi-Principal Structure):</strong>
              <span>هیچ محدودیتی در تعداد مدیران هر واحد آموزشی وجود ندارد و هر دو یا چند مدیر می‌توانند به طور موازی اختیارات تام داشته باشند.</span>
            </div>
            {isPlatformAdmin && (
              <div className="flex items-center gap-2">
                <Link to="/create-school">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Sparkles size={14} />}
                    className="shadow-sm font-bold bg-[#2457C5] hover:bg-blue-700"
                  >
                    ویزارد تأسیس مدرسه (۵ مرحله)
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Plus size={14} />}
                  onClick={() => setIsCreateSchoolModalOpen(true)}
                >
                  ثبت سریع مدرسه
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schools.map((school) => {
              const coPrincipals = school.coPrincipals || [school.principalName];
              return (
                <Card key={school.id} className="text-right flex flex-col justify-between hover:border-blue-500/50 transition-all">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-bold text-[#2457C5] dark:text-[#8BAEFF] bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-md">
                        کد: {school.code}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">سال: {school.academicYear}</span>
                    </div>

                    <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">{school.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{school.branch}</p>

                    {/* Co-Principals Roster */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="flex items-center gap-1 font-semibold">
                          <UserCheck size={13} className="text-emerald-600" />
                          مدیران منصوب ({toPersianDigits(coPrincipals.length)} نفر):
                        </span>
                        <span className="text-[10px] text-emerald-600 font-bold">دسترسی فول تام</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {coPrincipals.map((p, pIdx) => (
                          <span
                            key={pIdx}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded text-[11px] font-bold text-slate-800 dark:text-slate-200"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 space-y-1 pt-1">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate">{school.address}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Phone size={12} className="text-slate-400 shrink-0" />
                        <span>{school.phone}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-400">ظرفیت: {toPersianDigits(school.capacity || 300)} دانش‌آموز</span>
                    <button
                      onClick={() => {
                        setSelectedSchoolForPrincipals(school);
                        setSelectedCoPrincipals(school.coPrincipals || [school.principalName]);
                        setIsAssignPrincipalsModalOpen(true);
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center gap-1"
                    >
                      <span>مدیریت مدیران</span>
                      <ChevronRight size={12} className="rotate-180" />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: STAFF & DEPUTIES MANAGEMENT (PRINCIPAL FULL ACCESS) */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">کادر اجرایی و اداری مدرسه</h3>
              <p className="text-xs text-slate-500">معاونت آموزشی، معاونت انضباطی، ناظم، مشاوران، و مسئولین ثبت‌نام</p>
            </div>
            {isPrincipal && (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => setIsCreateStaffModalOpen(true)}
              >
                افزودن همکار به کادر
              </Button>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-3">نام و نام‌خانوادگی</th>
                  <th className="py-3 px-3">سمت و نقش اداری</th>
                  <th className="py-3 px-3">شماره همراه</th>
                  <th className="py-3 px-3">کد ملی</th>
                  <th className="py-3 px-3 text-center">دامنه اختیارات</th>
                  <th className="py-3 px-3 text-center">وضعیت حساب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[
                  { name: 'دکتر احمدرضا جلالی', role: 'مدیر ارشد مدرسه (Principal)', phone: '۰۲۱-۲۲۰۰۵۵۴۴', nid: '۰۰۵۴۳۲۱۰۹۸', scope: 'کل واحد آموزشی (تام)', status: 'فعال' },
                  { name: 'مهندس کامران رضایی', role: 'مدیر همکار (Co-Principal)', phone: '۰۹۱۲۲۲۲۳۳۴۴', nid: '۰۰۴۳۲۱۸۷۶۵', scope: 'کل واحد آموزشی (تام)', status: 'فعال' },
                  { name: 'استاد مسعود پروانه', role: 'معاون آموزشی (Academic Deputy)', phone: '۰۹۱۲۳۴۵۶۷۸۹', nid: '۰۰۱۲۳۴۵۶۷۸', scope: 'معاونت آموزش و تدریس', status: 'فعال' },
                  { name: 'علی قربانی', role: 'معاون انضباطی و ناظم (Disciplinary)', phone: '۰۹۱۹۴۴۴۵۵۶۶', nid: '۰۰۷۶۵۴۳۲۱۰', scope: 'انضباط و سرویس‌ها', status: 'فعال' },
                  { name: 'سارا حسینی', role: 'مشاور تحصیلی و کنکور', phone: '۰۹۱۹۲۲۲۱۱۰۰', nid: '۰۰۳۲۱۴۵۶۹۸', scope: 'هدایت تحصیلی', status: 'فعال' },
                  { name: 'زهرا مرادی', role: 'مسئول دفتر و ثبت‌نام', phone: '۰۹۱۲۵۵۵۴۴۳۳', nid: '۰۰۹۸۷۶۵۴۳۲', scope: 'ثبت‌نام و روابط اولیا', status: 'فعال' },
                ].map((st, sIdx) => (
                  <tr key={sIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">{st.name}</td>
                    <td className="py-3 px-3 text-blue-600 dark:text-blue-400 font-semibold">{st.role}</td>
                    <td className="py-3 px-3 font-mono text-slate-500">{st.phone}</td>
                    <td className="py-3 px-3 font-mono text-slate-500">{st.nid}</td>
                    <td className="py-3 px-3 text-center">
                      <span className="text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-medium">
                        {st.scope}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 size={12} />
                        {st.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TEACHERS & ACADEMIC FACULTY (EDUCATIONAL DEPUTY / PRINCIPAL) */}
      {activeTab === 'teachers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">فهرست دبیران و مدرسان دوره‌ها</h3>
              <p className="text-xs text-slate-500">معاون آموزشی می‌تواند معلمان جدید اضافه کند و دروس کلاسی را تخصیص دهد</p>
            </div>
            {(isPrincipal || isEduDeputy) && (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => setIsCreateTeacherModalOpen(true)}
              >
                افزودن معلم جدید
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: 'مهندس محسن کریمی', subject: 'حسابان و ریاضیات ۱، هندسه ۱', classes: 'کلاس ۱۰۱، کلاس ۱۰۲', studentsCount: 56, phone: '۰۹۱۲۴۴۴۵۵۶۶' },
              { name: 'دکتر فاطمه صابری', subject: 'شیمی ۱ و زیست‌شناسی ۱', classes: 'کلاس ۱۰۱، کلاس ۱۰۲', studentsCount: 56, phone: '۰۹۱۲۸۸۸۹۹۰۰' },
              { name: 'استاد حمید امانی', subject: 'ادبیات فارسی، دین و زندگی', classes: 'کلاس ۱۰۱، ۱۰۲، ۱۰۳', studentsCount: 84, phone: '۰۹۱۲۳۳۳۲۲۱۱' },
              { name: 'استاد مسعود پروانه', subject: 'زبان انگلیسی تخصصی، فیزیک', classes: 'کلاس ۱۰۱، کلاس ۱۰۳', studentsCount: 56, phone: '۰۹۱۲۷۷۷۶۶۵۵' },
            ].map((tch, tIdx) => (
              <Card key={tIdx} className="text-right space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{tch.name}</span>
                  <Badge variant="primary">دبیر رسمی</Badge>
                </div>
                <div className="text-xs space-y-1">
                  <div><span className="text-slate-400">دروس تدریس:</span> <strong className="text-blue-600 dark:text-blue-400">{tch.subject}</strong></div>
                  <div><span className="text-slate-400">کلاس‌های تحت تدریس:</span> <span>{tch.classes}</span></div>
                  <div><span className="text-slate-400">تعداد دانش‌آموزان:</span> <span className="font-mono">{toPersianDigits(tch.studentsCount)} نفر</span></div>
                  <div><span className="text-slate-400">شماره تماس:</span> <span className="font-mono text-slate-600">{tch.phone}</span></div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB: CLASSROOMS MANAGEMENT */}
      {activeTab === 'classrooms' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-2xl text-xs text-blue-900 dark:text-blue-200">
            <div>
              <strong className="block font-bold">مدیریت کلاس‌های درس و دبیران راهنما:</strong>
              <span>تعریف کلاس‌های جدید، تعیین پایه، رشته، شماره فضا و انتساب دبیر مسئول کلاس.</span>
            </div>
            {(isPrincipal || isEduDeputy || isPlatformAdmin) && (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => setIsCreateClassModalOpen(true)}
              >
                تعریف کلاس جدید
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classrooms.map((cls) => {
              const headTeacher = users.find((u) => u.id === cls.headTeacherId);
              const enrolledCount = students.filter((s) => s.classroomId === cls.id).length;
              return (
                <Card key={cls.id} className="text-right space-y-3 hover:border-blue-500/50 transition-all">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{cls.name}</span>
                    <Badge variant="primary">{cls.grade}</Badge>
                  </div>
                  <div className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">رشته تحصیلی:</span>
                      <strong className="text-blue-600 dark:text-blue-400">{cls.field}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">شماره اتاق / فضا:</span>
                      <span className="font-mono">{cls.roomNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">دبیر راهنما:</span>
                      <strong className="text-emerald-700 dark:text-emerald-400">{headTeacher?.fullName || 'مهندس کریمی'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">دانش‌آموزان کلاس:</span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{toPersianDigits(enrolledCount || cls.studentCount)} نفر</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: STUDENTS ENROLLMENT (EDUCATIONAL DEPUTY / PRINCIPAL) */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">فهرست دانش‌آموزان ثبت‌نام‌شده</h3>
              <p className="text-xs text-slate-500">معاون آموزشی مجاز به ثبت‌نام دانش‌آموز و تخصیص کلاس و پایه است</p>
            </div>
            {(isPrincipal || isEduDeputy) && (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => setIsCreateStudentModalOpen(true)}
              >
                ثبت‌نام دانش‌آموز جدید
              </Button>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-3">ردیف</th>
                  <th className="py-3 px-3">نام و نام‌خانوادگی</th>
                  <th className="py-3 px-3">شماره دانش‌آموزی</th>
                  <th className="py-3 px-3">کلاس و پایه</th>
                  <th className="py-3 px-3">کد ملی</th>
                  <th className="py-3 px-3 text-center">وضعیت تحصیلی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {students.slice(0, 15).map((std, idx) => (
                  <tr key={std.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-mono text-slate-400">{toPersianDigits(idx + 1)}</td>
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">{std.fullName}</td>
                    <td className="py-3 px-3 font-mono text-slate-600">{toPersianDigits(std.studentNumber)}</td>
                    <td className="py-3 px-3 text-blue-600 dark:text-blue-400 font-medium">
                      {INITIAL_CLASSROOMS.find((c) => c.id === std.classroomId)?.name || 'کلاس ۱۰۱'}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500">{std.nationalId}</td>
                    <td className="py-3 px-3 text-center">
                      <span className="text-[11px] bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded font-bold">
                        اشتغال به تحصیل
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: BUS ROUTES & DRIVERS MANAGEMENT (DISCIPLINARY DEPUTY / PRINCIPAL) */}
      {activeTab === 'transport' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 rounded-2xl text-xs text-indigo-900 dark:text-indigo-200">
            <div>
              <strong className="block font-bold">مدیریت ناوگان حمل‌ونقل و سرویس‌ها (مخصوص معاون انضباطی):</strong>
              <span>معاون انضباطی سیستم سرویس‌ها را مدیریت می‌کند، رانندگان را اضافه می‌نماید و مسیرها و ایستگاه‌ها را تعیین می‌کند.</span>
            </div>
            {(isPrincipal || isDisciplinaryDeputy) && (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => setIsCreateRouteModalOpen(true)}
              >
                تعریف مسیر و خط جدید
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {busRoutes.map((route) => (
              <Card key={route.id} className="text-right flex flex-col justify-between hover:border-indigo-500/50 transition-all">
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-md">
                      {route.lineCode}
                    </span>
                    <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      خط فعال
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{route.title}</h3>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">نام راننده:</span>
                      <strong className="text-slate-800 dark:text-slate-200">{route.driverName}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">شماره تماس راننده:</span>
                      <span className="font-mono text-slate-600 dark:text-slate-300">{route.driverPhone}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">خودرو و پلاک:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{route.vehicleModel} ({route.plateNumber})</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">ظرفیت مسافر:</span>
                      <span className="font-mono font-bold text-blue-600">{toPersianDigits(route.capacity)} نفر</span>
                    </div>
                  </div>

                  {/* Stops */}
                  <div className="text-xs space-y-1 pt-1">
                    <span className="text-slate-400 block text-[11px]">ایستگاه‌های مسیر:</span>
                    <div className="flex flex-wrap gap-1">
                      {route.stops.map((stop, sIdx) => (
                        <span key={sIdx} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] px-2 py-0.5 rounded">
                          {stop}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>ساعت حرکت صبح: {route.morningDepartureTime}</span>
                  <span>برگشت: {route.eveningDepartureTime}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: ALL USERS & RBAC MATRIX */}
      {activeTab === 'all_users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-2 border-b border-[#DCE3EE] dark:border-[#344257]">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="جستجو با نام، کد ملی یا شماره همراه..."
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">
                مجموع کاربران: <strong className="tabular-nums">{toPersianDigits(users.length)}</strong> نفر
              </span>
              {isPrincipal && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<UserPlus size={14} />}
                  onClick={() => setIsAssignRoleModalOpen(true)}
                >
                  انتساب نقش جدید
                </Button>
              )}
            </div>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-[#DCE3EE] dark:border-[#344257] text-[#526176] dark:text-[#B3C0D2]">
                    <th className="pb-3 pr-2 font-medium">نام و نام خانوادگی</th>
                    <th className="pb-3 font-medium text-center">کد ملی</th>
                    <th className="pb-3 font-medium text-center">شماره همراه</th>
                    <th className="pb-3 font-medium">نقش‌های منتسب و زمینه کاری</th>
                    <th className="pb-3 font-medium text-center">وضعیت حساب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE3EE]/60 dark:divide-[#344257]/60">
                  {users
                    .filter(
                      (u) =>
                        u.fullName.includes(searchQuery) ||
                        u.nationalId.includes(searchQuery) ||
                        u.phoneNumber.includes(searchQuery)
                    )
                    .map((user) => {
                      const userRas = assignments.filter((ra) => ra.userId === user.id && !ra.isRevoked);
                      return (
                        <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-3 pr-2 font-bold text-[#202B3C] dark:text-[#F1F5FB]">{user.fullName}</td>
                          <td className="py-3 text-center font-mono tabular-nums text-slate-500">{user.nationalId}</td>
                          <td className="py-3 text-center font-mono tabular-nums text-slate-500">{user.phoneNumber}</td>
                          <td className="py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {userRas.map((ra) => {
                                const r = allRoles.find((role) => role.id === ra.roleId);
                                return (
                                  <span
                                    key={ra.id}
                                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-blue-50 text-[#2457C5] dark:bg-blue-950 dark:text-[#8BAEFF] border border-blue-200/50 dark:border-blue-800"
                                  >
                                    <span>{r?.persianTitle}</span>
                                    {ra.scopeType === 'classroom' && (
                                      <span className="text-[10px] text-slate-500">(کلاس ۱۰۱)</span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-3 text-center">
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                              <CheckCircle2 size={13} />
                              <span>فعال</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 1: CREATE SCHOOL (PLATFORM ADMIN) */}
      <Modal
        isOpen={isCreateSchoolModalOpen}
        onClose={() => setIsCreateSchoolModalOpen(false)}
        title="تأسیس و ثبت واحد آموزشی جدید در پلتفرم"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSchool} className="space-y-4 text-right">
          <FormField label="نام رسمی مدرسه" required>
            <input
              type="text"
              placeholder="مثلاً: دبیرستان غیردولتی هوشمند مشاهیر آینده"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              required
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="کد مدرسه" required>
              <input
                type="text"
                value={schoolCode}
                onChange={(e) => setSchoolCode(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                required
              />
            </FormField>

            <FormField label="مقطع تحصیلی و شعبه">
              <input
                type="text"
                value={schoolBranch}
                onChange={(e) => setSchoolBranch(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </FormField>

            <FormField label="مدیر اول واحد آموزشی (تام‌الاختیار)" required>
              <input
                type="text"
                value={schoolPrincipal1}
                onChange={(e) => setSchoolPrincipal1(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                required
              />
            </FormField>

            <FormField label="مدیر دوم همکار (اختیاری - بدون محدودیت)">
              <input
                type="text"
                placeholder="نام مدیر دوم (اختیاری)"
                value={schoolPrincipal2}
                onChange={(e) => setSchoolPrincipal2(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </FormField>
          </div>

          <FormField label="آدرس کامل مدرسه">
            <input
              type="text"
              value={schoolAddress}
              onChange={(e) => setSchoolAddress(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" size="sm" onClick={() => setIsCreateSchoolModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" size="sm" type="submit" icon={<Building2 size={14} />}>
              تأسیس مدرسه
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: ASSIGN MULTI-PRINCIPALS */}
      <Modal
        isOpen={isAssignPrincipalsModalOpen}
        onClose={() => setIsAssignPrincipalsModalOpen(false)}
        title={`مدیریت مدیران همکار — ${selectedSchoolForPrincipals?.name || ''}`}
        maxWidth="md"
      >
        <form onSubmit={handleSavePrincipals} className="space-y-4 text-right">
          <p className="text-xs text-slate-500">
            این مدرسه می‌تواند به صورت هم‌زمان دارای چندین مدیر با اختیارات مساوی و مستقل باشد.
          </p>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">مدیران فعلی:</span>
            {selectedCoPrincipals.map((pr, pIdx) => (
              <div key={pIdx} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-between text-xs">
                <span className="font-bold">{pr}</span>
                {selectedCoPrincipals.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSelectedCoPrincipals((prev) => prev.filter((_, idx) => idx !== pIdx))}
                    className="text-rose-600 hover:underline text-[11px]"
                  >
                    حذف
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="text"
              placeholder="نام مدیر همکار جدید..."
              value={newPrincipalNameInput}
              onChange={(e) => setNewPrincipalNameInput(e.target.value)}
              className="flex-1 text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                if (newPrincipalNameInput.trim()) {
                  setSelectedCoPrincipals((prev) => [...prev, newPrincipalNameInput.trim()]);
                  setNewPrincipalNameInput('');
                }
              }}
            >
              افزودن مدیر
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" size="sm" onClick={() => setIsAssignPrincipalsModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" size="sm" type="submit">
              ذخیره تغییرات مدیران
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: CREATE STAFF (PRINCIPAL FULL ACCESS) */}
      <Modal
        isOpen={isCreateStaffModalOpen}
        onClose={() => setIsCreateStaffModalOpen(false)}
        title="استخدام و افزودن عضو کادر اداری مدرسه"
        maxWidth="md"
      >
        <form onSubmit={handleCreateStaff} className="space-y-4 text-right">
          <FormField label="نام و نام‌خانوادگی" required>
            <input
              type="text"
              value={staffFullName}
              onChange={(e) => setStaffFullName(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              required
            />
          </FormField>

          <FormField label="سمت و مسئولیت" required>
            <select
              value={staffRole}
              onChange={(e) => setStaffRole(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <option value="educational_deputy">معاونت آموزشی (مدیریت کلاس‌ها، معلمان و نمرات)</option>
              <option value="disciplinary_deputy">معاونت انضباطی (مدیریت سرویس‌ها، غیبت‌ها و رفتار)</option>
              <option value="attendance_supervisor">ناظم و مسئول ثبت و اصلاح حضور و غیاب</option>
              <option value="academic_counselor">مشاور تحصیلی و برنامه‌ریزی</option>
              <option value="school_registrar">مسئول دفتر و ثبت‌نام و احکام حضانت</option>
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="شماره همراه">
              <input
                type="text"
                value={staffPhone}
                onChange={(e) => setStaffPhone(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </FormField>
            <FormField label="کد ملی">
              <input
                type="text"
                value={staffNationalId}
                onChange={(e) => setStaffNationalId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" size="sm" onClick={() => setIsCreateStaffModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" size="sm" type="submit">
              ثبت عضو کادر
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: CREATE TEACHER (EDUCATIONAL DEPUTY / PRINCIPAL) */}
      <Modal
        isOpen={isCreateTeacherModalOpen}
        onClose={() => setIsCreateTeacherModalOpen(false)}
        title="استخدام و تخصیص دبیر جدید"
        maxWidth="md"
      >
        <form onSubmit={handleCreateTeacher} className="space-y-4 text-right">
          <FormField label="نام و نام‌خانوادگی دبیر" required>
            <input
              type="text"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              required
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="عنوان درس تخصصی" required>
              <input
                type="text"
                value={teacherSubject}
                onChange={(e) => setTeacherSubject(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                required
              />
            </FormField>
            <FormField label="کلاس تحت تدریس" required>
              <select
                value={teacherClassId}
                onChange={(e) => setTeacherClassId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                {INITIAL_CLASSROOMS.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" size="sm" onClick={() => setIsCreateTeacherModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" size="sm" type="submit">
              ثبت دبیر
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 5: CREATE STUDENT (EDUCATIONAL DEPUTY / PRINCIPAL) */}
      <Modal
        isOpen={isCreateStudentModalOpen}
        onClose={() => setIsCreateStudentModalOpen(false)}
        title="ثبت‌نام دانش‌آموز جدید و تعریف اولیا"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateStudent} className="space-y-4 text-right">
          <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200/50 space-y-3">
            <span className="font-bold text-xs text-[#2457C5] dark:text-[#8BAEFF] block">مشخصات دانش‌آموز</span>
            <FormField label="نام و نام‌خانوادگی دانش‌آموز *" required>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="مثال: پارسا رادمنش"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                required
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="کلاس و پایه تحصیلی *" required>
                <select
                  value={studentClassId}
                  onChange={(e) => setStudentClassId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.grade})</option>
                  ))}
                </select>
              </FormField>
              <FormField label="شماره دانش‌آموزی">
                <input
                  type="text"
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                />
              </FormField>
            </div>

            <FormField label="کد ملی دانش‌آموز">
              <input
                type="text"
                value={studentNationalId}
                onChange={(e) => setStudentNationalId(e.target.value)}
                placeholder="۰۱۴۵۶۷۸۹۰۱"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
              />
            </FormField>
          </div>

          {/* Parent Registration & Linking */}
          <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/50 space-y-3">
            <span className="font-bold text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <HeartHandshake size={14} />
              <span>مشخصات و ثبت اولیای قانونی دانش‌آموز (پدر / مادر / قیم)</span>
            </span>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="نسبت با دانش‌آموز">
                <select
                  value={studentGuardianRelation}
                  onChange={(e) => setStudentGuardianRelation(e.target.value as GuardianRelationshipType)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="father">پدر</option>
                  <option value="mother">مادر</option>
                  <option value="legal_guardian">سرپرست قانونی (قیم)</option>
                </select>
              </FormField>

              <FormField label="نام و نام خانوادگی ولی">
                <input
                  type="text"
                  value={studentGuardianName}
                  onChange={(e) => setStudentGuardianName(e.target.value)}
                  placeholder="مثال: فریبا کاظمی"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="کد ملی ولی">
                <input
                  type="text"
                  value={studentGuardianNationalId}
                  onChange={(e) => setStudentGuardianNationalId(e.target.value)}
                  placeholder="۰۰۳۴۵۶۷۸۹۰"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                />
              </FormField>

              <FormField label="شماره همراه ولی (جهت دریافت پیامک)">
                <input
                  type="text"
                  value={studentGuardianPhone}
                  onChange={(e) => setStudentGuardianPhone(e.target.value)}
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                />
              </FormField>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" size="sm" onClick={() => setIsCreateStudentModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" size="sm" type="submit">
              تکمیل ثبت‌نام دانش‌آموز و پیوند اولیا
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: CREATE CLASSROOM */}
      <Modal
        isOpen={isCreateClassModalOpen}
        onClose={() => setIsCreateClassModalOpen(false)}
        title="تعریف کلاس درس جدید در واحد آموزشی"
        maxWidth="md"
      >
        <form onSubmit={handleCreateClassroom} className="space-y-4 text-right">
          <FormField label="نام یا عنوان کلاس *" required>
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="مثلاً: کلاس ۱۰۳ (دهم انسانی)"
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              required
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="پایه تحصیلی">
              <select
                value={newClassGrade}
                onChange={(e) => setNewClassGrade(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="پایه دهم">پایه دهم</option>
                <option value="پایه یازدهم">پایه یازدهم</option>
                <option value="پایه دوازدهم">پایه دوازدهم</option>
              </select>
            </FormField>

            <FormField label="رشته تحصیلی">
              <select
                value={newClassField}
                onChange={(e) => setNewClassField(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="ریاضی و فیزیک">ریاضی و فیزیک</option>
                <option value="علوم تجربی">علوم تجربی</option>
                <option value="ادبیات و علوم انسانی">ادبیات و علوم انسانی</option>
                <option value="فنی و مهندسی">فنی و مهندسی</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="شماره اتاق / فضا">
              <input
                type="text"
                value={newClassRoom}
                onChange={(e) => setNewClassRoom(e.target.value)}
                placeholder="۱۰۳"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
              />
            </FormField>

            <FormField label="ظرفیت صندلی (نفر)">
              <input
                type="number"
                value={newClassCapacity}
                onChange={(e) => setNewClassCapacity(Number(e.target.value))}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
              />
            </FormField>
          </div>

          <FormField label="دبیر راهنما / معلم مسئول کلاس">
            <select
              value={newClassHeadTeacherId}
              onChange={(e) => setNewClassHeadTeacherId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.nationalId})
                </option>
              ))}
            </select>
          </FormField>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" size="sm" onClick={() => setIsCreateClassModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" size="sm" type="submit">
              ثبت کلاس درس
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 6: CREATE BUS ROUTE (DISCIPLINARY DEPUTY / PRINCIPAL) */}
      <Modal
        isOpen={isCreateRouteModalOpen}
        onClose={() => setIsCreateRouteModalOpen(false)}
        title="تعریف مسیر و خط سرویس مدرسه (معاونت انضباطی)"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateRoute} className="space-y-4 text-right">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="کد خط سرویس" required>
              <input
                type="text"
                placeholder="مثلاً: خط ۴"
                value={routeLineCode}
                onChange={(e) => setRouteLineCode(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                required
              />
            </FormField>
            <FormField label="عنوان مسیر" required>
              <input
                type="text"
                placeholder="مثلاً: مسیر پاسداران - هروی - اختیاریه"
                value={routeTitle}
                onChange={(e) => setRouteTitle(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                required
              />
            </FormField>
            <FormField label="نام و نام‌خانوادگی راننده" required>
              <input
                type="text"
                value={routeDriverName}
                onChange={(e) => setRouteDriverName(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                required
              />
            </FormField>
            <FormField label="شماره همراه راننده" required>
              <input
                type="text"
                value={routeDriverPhone}
                onChange={(e) => setRouteDriverPhone(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                required
              />
            </FormField>
            <FormField label="مدل خودرو">
              <input
                type="text"
                value={routeVehicle}
                onChange={(e) => setRouteVehicle(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </FormField>
            <FormField label="پلاک انتظامی">
              <input
                type="text"
                value={routePlate}
                onChange={(e) => setRoutePlate(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </FormField>
          </div>

          <FormField label="ایستگاه‌های مسیر (با ویرگول جدا کنید)">
            <textarea
              rows={2}
              value={routeStopsText}
              onChange={(e) => setRouteStopsText(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" size="sm" onClick={() => setIsCreateRouteModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" size="sm" type="submit" icon={<Bus size={14} />}>
              ثبت خط و راننده
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 7: ASSIGN ROLE TO USER */}
      <Modal
        isOpen={isAssignRoleModalOpen}
        onClose={() => setIsAssignRoleModalOpen(false)}
        title="انتساب نقش و تعیین قلمرو دسترسی"
        maxWidth="md"
      >
        <form onSubmit={handleAssignRole} className="space-y-4 text-right">
          <FormField label="انتخاب کاربر" required>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.nationalId})
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="نقش مورد انتساب" required>
            <select
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            >
              {allRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.persianTitle} ({r.description})
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="قلمرو دسترسی (Scope)" required>
            <select
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value as PermissionScope)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            >
              <option value="school">مدرسه (تمام کلاس‌ها و دانش‌آموزان)</option>
              <option value="classroom">کلاس مشخص (Classroom Scoped)</option>
              <option value="student">دانش‌آموز مشخص (Student Scoped)</option>
              <option value="platform">کلان پلتفرم (Platform Super Admin)</option>
            </select>
          </FormField>

          {selectedScope === 'classroom' && (
            <FormField label="انتخاب کلاس هدف">
              <select
                value={scopeClassId}
                onChange={(e) => setScopeClassId(e.target.value)}
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              >
                {INITIAL_CLASSROOMS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" size="sm" onClick={() => setIsAssignRoleModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" size="sm" type="submit">
              تأیید و انتساب نقش
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
