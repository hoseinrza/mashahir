import React, { useState } from 'react';
import {
  School, Users, BookOpen, GraduationCap, CheckCircle2, ArrowRight, ArrowLeft,
  Shield, Plus, Trash2, Sparkles, AlertCircle, Building2, UserPlus, Phone,
  Mail, MapPin, Check, HeartHandshake, FileText, Lock, ChevronRight, UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SchoolService, UserService, ClassroomService, FamilyService, AuditService } from '../../services';
import { School as SchoolType, Classroom, Student, User, GuardianRelationshipType } from '../../types';
import { Button, Card, Badge, FormField, Modal } from '../common';
import { toPersianDigits, cn } from '../../utils/persian';

interface StaffDraft {
  id: string;
  isNewUser: boolean;
  existingUserId?: string;
  fullName: string;
  nationalId: string;
  phoneNumber: string;
  email: string;
  roleId: string;
  roleTitle: string;
  subject?: string;
}

interface ClassroomDraft {
  id: string;
  name: string;
  grade: string;
  field: string;
  roomNumber: string;
  capacity: number;
  headTeacherId: string;
  headTeacherName: string;
}

interface StudentDraft {
  id: string;
  fullName: string;
  nationalId: string;
  studentNumber: string;
  gender: 'male' | 'female';
  birthDate: string;
  classroomId: string;
  className: string;
  // Linked Parent
  parentFullName: string;
  parentNationalId: string;
  parentPhone: string;
  parentRelation: GuardianRelationshipType;
  parentPermissions: {
    canViewAcademicReport: boolean;
    canViewAttendance: boolean;
    canReceiveSmsNotifications: boolean;
    canSignConsentForms: boolean;
    canPickupStudent: boolean;
  };
}

interface SchoolCreationWizardProps {
  onComplete?: (createdSchool: SchoolType) => void;
  onCancel?: () => void;
}

export const SchoolCreationWizard: React.FC<SchoolCreationWizardProps> = ({ onComplete, onCancel }) => {
  const { allUsers, currentUser } = useAuth();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 5;

  // ---------------- STEP 1: School Identity ----------------
  const [schoolName, setSchoolName] = useState('دبیرستان استعدادهای درخشان مشاهیر آینده (شعبه سعادت‌آباد)');
  const [schoolCode, setSchoolCode] = useState(`۹۵۸۲${Math.floor(1000 + Math.random() * 9000)}`);
  const [schoolType, setSchoolType] = useState('سمپاد / استعدادهای درخشان');
  const [schoolBranch, setSchoolBranch] = useState('متوسطه دوم (نظری)');
  const [schoolGender, setSchoolGender] = useState<'boys' | 'girls' | 'coed'>('boys');
  const [schoolProvince, setSchoolProvince] = useState('تهران');
  const [schoolCity, setSchoolCity] = useState('منطقه ۲ - سعادت‌آباد');
  const [schoolAddress, setSchoolAddress] = useState('تهران، بلوار شهرداری، خیابان بوستان، پلاک ۱۲');
  const [schoolPhone, setSchoolPhone] = useState('۰۲۱-۲۲۱۴۵۵۶۶');
  const [schoolCapacity, setSchoolCapacity] = useState<number>(360);
  const [schoolAcademicYear, setSchoolAcademicYear] = useState('۱۴۰۴-۱۴۰۵');

  // ---------------- STEP 2: Staff Assignment ----------------
  const [staffList, setStaffList] = useState<StaffDraft[]>([
    {
      id: 'stf_1',
      isNewUser: false,
      existingUserId: 'usr_principal',
      fullName: 'دکتر احمدرضا جلالی',
      nationalId: '۰۰۱۴۵۸۹۶۲۱',
      phoneNumber: '۰۹۱۲۱۱۱۱۱۱۱',
      email: 'jalali@mashahir.sch.ir',
      roleId: 'school_principal',
      roleTitle: 'مدیر ارشد واحد آموزشی',
      subject: 'مدیریت کلان',
    },
    {
      id: 'stf_2',
      isNewUser: false,
      existingUserId: 'usr_edu_deputy',
      fullName: 'مریم تهرانی',
      nationalId: '۰۰۲۳۴۵۸۷۱۲',
      phoneNumber: '۰۹۱۲۲۲۲۲۲۲۲',
      email: 'tehrani@mashahir.sch.ir',
      roleId: 'educational_deputy',
      roleTitle: 'معاونت آموزشی و برنامه‌ریزی',
      subject: 'امور آموزش',
    },
    {
      id: 'stf_3',
      isNewUser: false,
      existingUserId: 'usr_teacher_karimi',
      fullName: 'مهندس محسن کریمی',
      nationalId: '۰۰۴۵۶۷۸۹۰۱',
      phoneNumber: '۰۹۱۲۴۴۴۴۴۴۴',
      email: 'karimi.math@mashahir.sch.ir',
      roleId: 'teacher',
      roleTitle: 'دبیر ریاضیات و حسابان',
      subject: 'ریاضیات تخصصی',
    },
  ]);

  // Modal / Form to add Staff
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
  const [staffMode, setStaffMode] = useState<'existing' | 'new'>('existing');
  const [selectedExistingUserId, setSelectedExistingUserId] = useState(allUsers[0]?.id || '');
  const [newStaffFullName, setNewStaffFullName] = useState('');
  const [newStaffNationalId, setNewStaffNationalId] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('teacher');
  const [newStaffSubject, setNewStaffSubject] = useState('');

  const roleOptions = [
    { id: 'school_principal', title: 'مدیر ارشد مدرسه' },
    { id: 'educational_deputy', title: 'معاون آموزشی' },
    { id: 'disciplinary_deputy', title: 'معاون انضباطی / ناظم' },
    { id: 'school_counselor', title: 'مشاور تحصیلی و روانشناسی' },
    { id: 'teacher', title: 'دبیر / معلم دروس' },
    { id: 'school_registrar', title: 'مسئول دفتر و ثبت‌نام' },
  ];

  const handleAddStaff = () => {
    if (staffMode === 'existing') {
      const u = allUsers.find((usr) => usr.id === selectedExistingUserId);
      if (!u) return;
      const roleObj = roleOptions.find((r) => r.id === newStaffRole);
      const newStaff: StaffDraft = {
        id: `stf_${Date.now()}`,
        isNewUser: false,
        existingUserId: u.id,
        fullName: u.fullName,
        nationalId: u.nationalId,
        phoneNumber: u.phoneNumber,
        email: u.email,
        roleId: newStaffRole,
        roleTitle: roleObj?.title || 'کادر آموزشی',
        subject: newStaffSubject || undefined,
      };
      setStaffList((prev) => [...prev, newStaff]);
    } else {
      if (!newStaffFullName.trim() || !newStaffNationalId.trim()) return;
      const roleObj = roleOptions.find((r) => r.id === newStaffRole);
      const newStaff: StaffDraft = {
        id: `stf_${Date.now()}`,
        isNewUser: true,
        fullName: newStaffFullName.trim(),
        nationalId: newStaffNationalId.trim(),
        phoneNumber: newStaffPhone.trim() || '۰۹۱۲۰۰۰۰۰۰۰',
        email: newStaffEmail.trim() || `${newStaffNationalId}@mashahir.sch.ir`,
        roleId: newStaffRole,
        roleTitle: roleObj?.title || 'کادر آموزشی',
        subject: newStaffSubject || undefined,
      };
      setStaffList((prev) => [...prev, newStaff]);
    }

    // Reset
    setNewStaffFullName('');
    setNewStaffNationalId('');
    setNewStaffPhone('');
    setNewStaffEmail('');
    setNewStaffSubject('');
    setIsAddStaffModalOpen(false);
  };

  const handleRemoveStaff = (id: string) => {
    setStaffList((prev) => prev.filter((s) => s.id !== id));
  };

  // ---------------- STEP 3: Classrooms ----------------
  const [classroomsList, setClassroomsList] = useState<ClassroomDraft[]>([
    {
      id: 'cls_draft_1',
      name: 'کلاس ۱۰۱ (دهم ریاضی المپیاد)',
      grade: 'پایه دهم',
      field: 'ریاضی و فیزیک',
      roomNumber: '۱۰۱',
      capacity: 25,
      headTeacherId: 'stf_3',
      headTeacherName: 'مهندس محسن کریمی',
    },
    {
      id: 'cls_draft_2',
      name: 'کلاس ۱۰۲ (دهم تجربی الف)',
      grade: 'پایه دهم',
      field: 'علوم تجربی',
      roomNumber: '۱۰۲',
      capacity: 25,
      headTeacherId: 'stf_2',
      headTeacherName: 'مریم تهرانی',
    },
    {
      id: 'cls_draft_3',
      name: 'کلاس ۲۰۱ (یازدهم ریاضی تخصصی)',
      grade: 'پایه یازدهم',
      field: 'ریاضی و فیزیک',
      roomNumber: '۲۰۱',
      capacity: 28,
      headTeacherId: 'stf_3',
      headTeacherName: 'مهندس محسن کریمی',
    },
  ]);

  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [classNameInput, setClassNameInput] = useState('');
  const [classGradeInput, setClassGradeInput] = useState('پایه دهم');
  const [classFieldInput, setClassFieldInput] = useState('ریاضی و فیزیک');
  const [classRoomInput, setClassRoomInput] = useState('');
  const [classCapacityInput, setClassCapacityInput] = useState<number>(26);
  const [classHeadTeacherStaffId, setClassHeadTeacherStaffId] = useState(staffList[0]?.id || '');

  const handleAddClassroom = () => {
    if (!classNameInput.trim()) return;
    const teacher = staffList.find((s) => s.id === classHeadTeacherStaffId) || staffList[0];
    const newClass: ClassroomDraft = {
      id: `cls_d_${Date.now()}`,
      name: classNameInput.trim(),
      grade: classGradeInput,
      field: classFieldInput,
      roomNumber: classRoomInput.trim() || 'اتاق مرکزی',
      capacity: classCapacityInput || 25,
      headTeacherId: teacher ? teacher.id : '',
      headTeacherName: teacher ? teacher.fullName : 'تعیین‌نشده',
    };
    setClassroomsList((prev) => [...prev, newClass]);
    setClassNameInput('');
    setClassRoomInput('');
    setIsAddClassModalOpen(false);
  };

  const handleRemoveClassroom = (id: string) => {
    setClassroomsList((prev) => prev.filter((c) => c.id !== id));
  };

  // ---------------- STEP 4: Students & Linked Parents ----------------
  const [studentsList, setStudentsList] = useState<StudentDraft[]>([
    {
      id: 'std_draft_1',
      fullName: 'امیرحسین رضوی',
      nationalId: '۰۰۲۸۸۹۹۰۰۱',
      studentNumber: '۴۰۴۱۰۱',
      gender: 'male',
      birthDate: '۱۳۸۸/۰۴/۱۵',
      classroomId: classroomsList[0]?.id || 'cls_draft_1',
      className: classroomsList[0]?.name || 'کلاس ۱۰۱',
      parentFullName: 'دکتر محمد رضوی',
      parentNationalId: '۰۰۴۱۱۲۲۳۳۴',
      parentPhone: '۰۹۱۲۳۴۵۶۷۸۹',
      parentRelation: 'father',
      parentPermissions: {
        canViewAcademicReport: true,
        canViewAttendance: true,
        canReceiveSmsNotifications: true,
        canSignConsentForms: true,
        canPickupStudent: true,
      },
    },
    {
      id: 'std_draft_2',
      fullName: 'سپهر یزدانی',
      nationalId: '۰۰۲۹۹۰۰۱۱۲',
      studentNumber: '۴۰۴۱۰۲',
      gender: 'male',
      birthDate: '۱۳۸۸/۰۲/۱۱',
      classroomId: classroomsList[0]?.id || 'cls_draft_1',
      className: classroomsList[0]?.name || 'کلاس ۱۰۱',
      parentFullName: 'فاطمه صادقی',
      parentNationalId: '۰۰۴۲۲۳۳۴۴۵',
      parentPhone: '۰۹۱۹۱۱۱۲۲۳۳',
      parentRelation: 'mother',
      parentPermissions: {
        canViewAcademicReport: true,
        canViewAttendance: true,
        canReceiveSmsNotifications: true,
        canSignConsentForms: true,
        canPickupStudent: true,
      },
    },
  ]);

  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [stdName, setStdName] = useState('');
  const [stdNationalId, setStdNationalId] = useState('');
  const [stdNumber, setStdNumber] = useState('');
  const [stdGender, setStdGender] = useState<'male' | 'female'>('male');
  const [stdBirthDate, setStdBirthDate] = useState('۱۳۸۸/۰۵/۰۱');
  const [stdClassroomId, setStdClassroomId] = useState(classroomsList[0]?.id || '');
  // Parent
  const [parentName, setParentName] = useState('');
  const [parentNationalId, setParentNationalId] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentRelation, setParentRelation] = useState<GuardianRelationshipType>('father');
  const [parentSms, setParentSms] = useState(true);
  const [parentReport, setParentReport] = useState(true);
  const [parentAttendance, setParentAttendance] = useState(true);
  const [parentConsent, setParentConsent] = useState(true);
  const [parentPickup, setParentPickup] = useState(true);

  const handleAddStudent = () => {
    if (!stdName.trim() || !stdNationalId.trim()) return;
    const selectedClass = classroomsList.find((c) => c.id === stdClassroomId) || classroomsList[0];
    const newStudent: StudentDraft = {
      id: `std_d_${Date.now()}`,
      fullName: stdName.trim(),
      nationalId: stdNationalId.trim(),
      studentNumber: stdNumber.trim() || `۴۰۴${Math.floor(100 + Math.random() * 900)}`,
      gender: stdGender,
      birthDate: stdBirthDate,
      classroomId: selectedClass ? selectedClass.id : '',
      className: selectedClass ? selectedClass.name : 'کلاس عمومی',
      parentFullName: parentName.trim() || `ولی محترم ${stdName.trim()}`,
      parentNationalId: parentNationalId.trim() || `۰۰${Math.floor(10000000 + Math.random() * 90000000)}`,
      parentPhone: parentPhone.trim() || '۰۹۱۲۰۰۰۰۰۰۰',
      parentRelation: parentRelation,
      parentPermissions: {
        canViewAcademicReport: parentReport,
        canViewAttendance: parentAttendance,
        canReceiveSmsNotifications: parentSms,
        canSignConsentForms: parentConsent,
        canPickupStudent: parentPickup,
      },
    };

    setStudentsList((prev) => [...prev, newStudent]);
    // Reset
    setStdName('');
    setStdNationalId('');
    setStdNumber('');
    setParentName('');
    setParentNationalId('');
    setParentPhone('');
    setIsAddStudentModalOpen(false);
  };

  const handleRemoveStudent = (id: string) => {
    setStudentsList((prev) => prev.filter((s) => s.id !== id));
  };

  // ---------------- STEP 5: Final Submission & Provisioning ----------------
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [createdSchoolResult, setCreatedSchoolResult] = useState<SchoolType | null>(null);

  const handleFinalLaunch = () => {
    setIsProvisioning(true);

    try {
      const actorName = currentUser?.fullName || 'مدیر ارشد پلتفرم';

      // 1. Create School
      const newSchool = SchoolService.createSchool(
        {
          name: schoolName,
          branch: `${schoolBranch} — ${schoolType}`,
          code: schoolCode,
          academicYear: schoolAcademicYear,
          principalName: staffList.find((s) => s.roleId === 'school_principal')?.fullName || 'دکتر احمدرضا جلالی',
          coPrincipals: staffList.filter((s) => s.roleId === 'school_principal').map((s) => s.fullName),
          address: `${schoolProvince}، ${schoolCity}، ${schoolAddress}`,
          phone: schoolPhone,
          capacity: schoolCapacity,
        },
        actorName
      );

      // 2. Create / Assign Staff Users
      const staffUserMap: Record<string, string> = {}; // draftId -> userId
      staffList.forEach((staff) => {
        let userId = staff.existingUserId;
        if (staff.isNewUser || !userId) {
          const createdUser = UserService.createUser(
            {
              fullName: staff.fullName,
              nationalId: staff.nationalId,
              phoneNumber: staff.phoneNumber,
              email: staff.email,
              isActive: true,
            },
            actorName
          );
          userId = createdUser.id;
        }
        staffUserMap[staff.id] = userId;

        // Assign Role to Staff for this new school
        UserService.assignRole({
          userId,
          roleId: staff.roleId,
          schoolId: newSchool.id,
          scopeType: 'school',
          scopeId: newSchool.id,
          validFrom: '۱۴۰۴/۰۷/۰۱',
        });
      });

      // 3. Create Classrooms
      const classMap: Record<string, string> = {}; // draftId -> createdClassId
      classroomsList.forEach((cls) => {
        const headUserId = staffUserMap[cls.headTeacherId] || 'usr_teacher_karimi';
        const createdClass = ClassroomService.createClassroom(
          {
            schoolId: newSchool.id,
            name: cls.name,
            grade: cls.grade,
            field: cls.field,
            roomNumber: cls.roomNumber,
            headTeacherId: headUserId,
            studentCount: studentsList.filter((s) => s.classroomId === cls.id).length,
          },
          actorName
        );
        classMap[cls.id] = createdClass.id;
      });

      // 4. Create Students & Link Parents
      studentsList.forEach((std) => {
        const assignedClassId = classMap[std.classroomId] || Object.values(classMap)[0] || 'cls_101';
        const createdStudent = UserService.createStudent(
          {
            fullName: std.fullName,
            nationalId: std.nationalId,
            studentNumber: std.studentNumber,
            classroomId: assignedClassId,
            gender: std.gender,
            birthDate: std.birthDate,
            enrollmentStatus: 'active',
          },
          actorName
        );

        // Assign Student role
        UserService.assignRole({
          userId: createdStudent.userId,
          roleId: 'student_highschool',
          schoolId: newSchool.id,
          scopeType: 'student',
          scopeId: createdStudent.id,
          validFrom: '۱۴۰۴/۰۷/۰۱',
        });

        // Create Parent User & Link
        if (std.parentFullName && std.parentNationalId) {
          FamilyService.createGuardianAndLink(
            {
              guardianName: std.parentFullName,
              guardianNationalId: std.parentNationalId,
              guardianPhone: std.parentPhone,
              studentId: createdStudent.id,
              studentName: createdStudent.fullName,
              relationshipType: std.parentRelation,
              canViewAcademicReport: std.parentPermissions.canViewAcademicReport,
              canViewAttendance: std.parentPermissions.canViewAttendance,
              canReceiveSmsNotifications: std.parentPermissions.canReceiveSmsNotifications,
              canSignConsentForms: std.parentPermissions.canSignConsentForms,
              canPickupStudent: std.parentPermissions.canPickupStudent,
              notes: `ثبت توسط مدیر ارشد در هنگام راه‌اندازی مدرسه ${newSchool.name}`,
            },
            actorName
          );
        }
      });

      // Audit Log
      AuditService.log({
        actorId: currentUser?.id || 'usr_platform_admin',
        actorName,
        actorRole: 'مدیر ارشد پلتفرم',
        action: 'تأسیس و راه‌اندازی کامل واحد آموزشی جدید',
        entityType: 'permission',
        entityId: newSchool.id,
        description: `راه‌اندازی کامل مدرسه «${newSchool.name}» شامل ${staffList.length} کادر، ${classroomsList.length} کلاس و ${studentsList.length} دانش‌آموز به همراه اولیا`,
      });

      setCreatedSchoolResult(newSchool);
      setIsProvisioning(false);
      if (onComplete) {
        onComplete(newSchool);
      }
    } catch (e) {
      console.error(e);
      setIsProvisioning(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 text-right">
      {/* Wizard Header */}
      <div className="bg-gradient-to-l from-[#2457C5]/10 via-[#8BAEFF]/5 to-transparent dark:from-[#2457C5]/20 dark:via-[#1e293b] p-6 rounded-3xl border border-[#2457C5]/20 dark:border-[#8BAEFF]/20 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#2457C5] text-white flex items-center justify-center shadow-md shadow-[#2457C5]/30">
              <Building2 size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-wider text-[#2457C5] dark:text-[#8BAEFF] uppercase">
                  پنل اختصاصی مدیر ارشد پلتفرم
                </span>
                <Badge variant="primary">ویزارد تأسیس مدرسه</Badge>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] mt-1">
                فرآیند هوشمند ایجاد و راه‌اندازی واحد آموزشی جدید
              </h2>
              <p className="text-xs text-[#526176] dark:text-[#B3C0D2] mt-1">
                تعریف هویت مدرسه، انتصاب کادر با انتخاب یا ایجاد کاربر، ساخت کلاس‌ها و ثبت دانش‌آموزان همراه اولیا
              </p>
            </div>
          </div>

          {onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel}>
              انصراف و خروج
            </Button>
          )}
        </div>

        {/* Step Progress Bar */}
        <div className="mt-8 pt-6 border-t border-[#DCE3EE] dark:border-[#334155]">
          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            {[
              { num: 1, title: 'هویت مدرسه', icon: <Building2 size={15} /> },
              { num: 2, title: 'انتصاب کادر', icon: <Users size={15} /> },
              { num: 3, title: 'تعریف کلاس‌ها', icon: <BookOpen size={15} /> },
              { num: 4, title: 'دانش‌آموز و اولیا', icon: <GraduationCap size={15} /> },
              { num: 5, title: 'بازبینی و راه‌اندازی', icon: <Sparkles size={15} /> },
            ].map((step) => {
              const isPassed = currentStep > step.num;
              const isCurrent = currentStep === step.num;
              return (
                <div
                  key={step.num}
                  onClick={() => {
                    if (isPassed) setCurrentStep(step.num);
                  }}
                  className={cn(
                    'p-2.5 rounded-2xl border transition-all flex flex-col items-center gap-1.5 cursor-pointer',
                    isCurrent
                      ? 'border-[#2457C5] bg-white dark:bg-[#1a2536] text-[#2457C5] dark:text-[#8BAEFF] font-bold shadow-xs'
                      : isPassed
                      ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400'
                      : 'border-slate-200 dark:border-slate-800 text-slate-400 bg-slate-50/50 dark:bg-slate-900/30'
                  )}
                >
                  <div
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                      isCurrent
                        ? 'bg-[#2457C5] text-white shadow-xs'
                        : isPassed
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    )}
                  >
                    {isPassed ? <Check size={14} /> : toPersianDigits(step.num)}
                  </div>
                  <span className="text-[11px] font-medium hidden sm:inline">{step.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SUCCESS SCREEN IF COMPLETED */}
      {createdSchoolResult ? (
        <Card className="text-center py-12 px-6 space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg">
            <CheckCircle2 size={44} />
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <Badge variant="success">راه‌اندازی با موفقیت انجام شد</Badge>
            <h3 className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB]">
              واحد آموزشی «{createdSchoolResult.name}» تأسیس گردید
            </h3>
            <p className="text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed">
              تمامی کادر آموزشی منصوب شده، کلاس‌های درسی با ظرفیت تعیین‌شده ایجاد گشته و اطلاعات دانش‌آموزان به همراه اولیای قانونی در سامانه متصل و فعال گردیدند.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto pt-4 text-right">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] text-slate-500 block">کد سازمانی سناد:</span>
              <strong className="text-sm font-mono text-[#2457C5] dark:text-[#8BAEFF]">{createdSchoolResult.code}</strong>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] text-slate-500 block">تعداد کادر:</span>
              <strong className="text-sm">{toPersianDigits(staffList.length)} نفر</strong>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] text-slate-500 block">تعداد کلاس‌ها:</span>
              <strong className="text-sm">{toPersianDigits(classroomsList.length)} کلاس</strong>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] text-slate-500 block">دانش‌آموزان و اولیا:</span>
              <strong className="text-sm">{toPersianDigits(studentsList.length)} پرونده فعال</strong>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-center gap-3">
            <Button
              variant="primary"
              onClick={() => {
                if (onCancel) onCancel();
                else window.location.href = '/user-management';
              }}
              icon={<ArrowRight size={16} />}
            >
              مشاهده در مدیریت مدارس و کاربران
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCreatedSchoolResult(null);
                setCurrentStep(1);
              }}
              icon={<Plus size={16} />}
            >
              ایجاد یک مدرسه دیگر
            </Button>
          </div>
        </Card>
      ) : (
        /* WIZARD ACTIVE STEPS */
        <div>
          {/* STEP 1: School Identity */}
          {currentStep === 1 && (
            <Card className="space-y-6">
              <div className="border-b border-[#DCE3EE] dark:border-[#334155] pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#202B3C] dark:text-[#F1F5FB]">
                    گام اول: مشخصات هویتی و پروانه‌ای واحد آموزشی
                  </h3>
                  <p className="text-xs text-[#526176] dark:text-[#B3C0D2]">
                    اطلاعات پایه، مجوز آموزش و پرورش و موقعیت فیزیکی مدرسه
                  </p>
                </div>
                <Badge variant="neutral">مرحله ۱ از ۵</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <FormField label="نام رسمی واحد آموزشی *" required>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="مثال: دبیرستان استعدادهای درخشان مشاهیر آینده"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#2457C5]"
                  />
                </FormField>

                <FormField label="کد مدرسه در سناد / وزارتخانه *" required>
                  <input
                    type="text"
                    value={schoolCode}
                    onChange={(e) => setSchoolCode(e.target.value)}
                    placeholder="مثال: ۹۵۸۲۴۰۰۱"
                    className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#2457C5]"
                  />
                </FormField>

                <FormField label="نوع مدرسه">
                  <select
                    value={schoolType}
                    onChange={(e) => setSchoolType(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <option value="سمپاد / استعدادهای درخشان">سمپاد / استعدادهای درخشان</option>
                    <option value="غیردولتی الگو و بین‌الملل">غیردولتی الگو و بین‌الملل</option>
                    <option value="نمونه دولتی">نمونه دولتی</option>
                    <option value="شاهد">شاهد</option>
                    <option value="دولتی هیئت امنایی">دولتی هیئت امنایی</option>
                  </select>
                </FormField>

                <FormField label="دوره تحصیلی">
                  <select
                    value={schoolBranch}
                    onChange={(e) => setSchoolBranch(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <option value="متوسطه دوم (نظری)">متوسطه دوم (نظری - پایه‌های ۱۰، ۱۱، ۱۲)</option>
                    <option value="متوسطه اول">متوسطه اول (پایه‌های ۷، ۸، ۹)</option>
                    <option value="دبستان و پیش‌دبستان">دبستان (پایه‌های ۱ تا ۶)</option>
                    <option value="هنرستان فنی و حرفه‌ای">هنرستان فنی و حرفه‌ای / کاردانش</option>
                  </select>
                </FormField>

                <FormField label="جنسیت دانش‌آموزان">
                  <div className="flex gap-4 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        checked={schoolGender === 'boys'}
                        onChange={() => setSchoolGender('boys')}
                        className="text-[#2457C5]"
                      />
                      <span>پسرانه</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        checked={schoolGender === 'girls'}
                        onChange={() => setSchoolGender('girls')}
                        className="text-[#2457C5]"
                      />
                      <span>دخترانه</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        checked={schoolGender === 'coed'}
                        onChange={() => setSchoolGender('coed')}
                        className="text-[#2457C5]"
                      />
                      <span>مختلط (ابتدایی)</span>
                    </label>
                  </div>
                </FormField>

                <FormField label="سال تحصیلی">
                  <input
                    type="text"
                    value={schoolAcademicYear}
                    onChange={(e) => setSchoolAcademicYear(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </FormField>

                <FormField label="استان و منطقه آموزش و پرورش">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={schoolProvince}
                      onChange={(e) => setSchoolProvince(e.target.value)}
                      placeholder="استان"
                      className="px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                    <input
                      type="text"
                      value={schoolCity}
                      onChange={(e) => setSchoolCity(e.target.value)}
                      placeholder="منطقه / شهر"
                      className="px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                </FormField>

                <FormField label="ظرفیت اسمی دانش‌آموز (نفر)">
                  <input
                    type="number"
                    value={schoolCapacity}
                    onChange={(e) => setSchoolCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </FormField>

                <FormField label="تلفن تماس دبیرخانه">
                  <input
                    type="text"
                    value={schoolPhone}
                    onChange={(e) => setSchoolPhone(e.target.value)}
                    placeholder="مثال: ۰۲۱-۲۲۱۴۵۵۶۶"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </FormField>

                <div className="md:col-span-2">
                  <FormField label="نشانی کامل پستی واحد آموزشی">
                    <input
                      type="text"
                      value={schoolAddress}
                      onChange={(e) => setSchoolAddress(e.target.value)}
                      placeholder="خیابان، کوچه، پلاک و کدپستی"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </FormField>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-[#DCE3EE] dark:border-[#334155]">
                <span className="text-xs text-slate-500">
                  در مرحله بعد کادر مدیریت و اساتید را انتخاب یا تعریف خواهید کرد.
                </span>
                <Button
                  variant="primary"
                  onClick={() => setCurrentStep(2)}
                  icon={<ArrowLeft size={16} />}
                >
                  گام بعدی: انتصاب کادر مدرسه
                </Button>
              </div>
            </Card>
          )}

          {/* STEP 2: Staff Assignment (Select or Create User) */}
          {currentStep === 2 && (
            <Card className="space-y-6">
              <div className="border-b border-[#DCE3EE] dark:border-[#334155] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#202B3C] dark:text-[#F1F5FB]">
                    گام دوم: انتصاب کادر اداری و آموزشی مدرسه
                  </h3>
                  <p className="text-xs text-[#526176] dark:text-[#B3C0D2]">
                    می‌توانید کادر را از بین کاربران موجود انتخاب کنید یا کاربر جدید با کدملی و شماره تماس بسازید
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsAddStaffModalOpen(true)}
                  icon={<UserPlus size={16} />}
                >
                  افزودن عضو جدید کادر
                </Button>
              </div>

              {/* Staff Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 pb-2">
                      <th className="py-2.5 font-bold">ردیف</th>
                      <th className="py-2.5 font-bold">نام و نام خانوادگی</th>
                      <th className="py-2.5 font-bold">سمت و عنوان</th>
                      <th className="py-2.5 font-bold">کد ملی</th>
                      <th className="py-2.5 font-bold">تلفن همراه</th>
                      <th className="py-2.5 font-bold">نوع انتصاب</th>
                      <th className="py-2.5 font-bold text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {staffList.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-3 font-mono">{toPersianDigits(idx + 1)}</td>
                        <td className="py-3 font-bold text-sm text-[#202B3C] dark:text-[#F1F5FB]">
                          {s.fullName}
                          {s.subject && <span className="text-[11px] font-normal text-slate-500 mr-1.5">({s.subject})</span>}
                        </td>
                        <td className="py-3">
                          <Badge variant={s.roleId === 'school_principal' ? 'primary' : 'neutral'}>
                            {s.roleTitle}
                          </Badge>
                        </td>
                        <td className="py-3 font-mono tabular-nums">{toPersianDigits(s.nationalId)}</td>
                        <td className="py-3 font-mono tabular-nums">{toPersianDigits(s.phoneNumber)}</td>
                        <td className="py-3">
                          <span
                            className={cn(
                              'text-[10px] px-2 py-0.5 rounded-md font-medium',
                              s.isNewUser
                                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-300'
                            )}
                          >
                            {s.isNewUser ? 'ایجاد کاربر جدید' : 'انتخاب کاربر موجود'}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <button
                            onClick={() => handleRemoveStaff(s.id)}
                            className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            title="حذف از کادر"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {staffList.length === 0 && (
                <div className="p-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed">
                  هنوز هیچ عضوی برای کادر اضافه نشده است. لطفاً حداقل مدیر مدرسه را اضافه نمایید.
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-[#DCE3EE] dark:border-[#334155]">
                <Button variant="outline" onClick={() => setCurrentStep(1)} icon={<ArrowRight size={16} />}>
                  بازگشت به گام اول
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setCurrentStep(3)}
                  disabled={staffList.length === 0}
                  icon={<ArrowLeft size={16} />}
                >
                  گام بعدی: تعریف کلاس‌های درس
                </Button>
              </div>
            </Card>
          )}

          {/* STEP 3: Classrooms Creation */}
          {currentStep === 3 && (
            <Card className="space-y-6">
              <div className="border-b border-[#DCE3EE] dark:border-[#334155] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#202B3C] dark:text-[#F1F5FB]">
                    گام سوم: تعریف کلاس‌های درس و انتصاب دبیر راهنما
                  </h3>
                  <p className="text-xs text-[#526176] dark:text-[#B3C0D2]">
                    کلاس‌های مدرسه را با ظرفیت، پایه، رشته و دبیر راهنما تعیین نمایید
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsAddClassModalOpen(true)}
                  icon={<Plus size={16} />}
                >
                  تعریف کلاس جدید
                </Button>
              </div>

              {/* Classrooms Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {classroomsList.map((cls) => (
                  <div
                    key={cls.id}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-xs transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-[#2457C5]/10 text-[#2457C5] dark:text-[#8BAEFF] flex items-center justify-center font-bold">
                          <BookOpen size={18} />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-[#202B3C] dark:text-[#F1F5FB]">{cls.name}</h4>
                          <span className="text-[11px] text-slate-500">{cls.grade} — {cls.field}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveClassroom(cls.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1"
                        title="حذف کلاس"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                      <div className="flex items-center justify-between">
                        <span>شماره اتاق / فضا:</span>
                        <strong className="font-mono">{cls.roomNumber}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>ظرفیت صندلی:</span>
                        <strong className="font-mono">{toPersianDigits(cls.capacity)} نفر</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>دبیر راهنما:</span>
                        <span className="font-bold text-[#2457C5] dark:text-[#8BAEFF]">{cls.headTeacherName}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {classroomsList.length === 0 && (
                <div className="p-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed">
                  هنوز کلاسی تعریف نشده است. برای ثبت دانش‌آموز در مرحله بعد، حداقل یک کلاس نیاز است.
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-[#DCE3EE] dark:border-[#334155]">
                <Button variant="outline" onClick={() => setCurrentStep(2)} icon={<ArrowRight size={16} />}>
                  بازگشت به کادر مدرسه
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setCurrentStep(4)}
                  disabled={classroomsList.length === 0}
                  icon={<ArrowLeft size={16} />}
                >
                  گام بعدی: افزودن دانش‌آموزان و اولیا
                </Button>
              </div>
            </Card>
          )}

          {/* STEP 4: Students & Linked Parents */}
          {currentStep === 4 && (
            <Card className="space-y-6">
              <div className="border-b border-[#DCE3EE] dark:border-[#334155] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#202B3C] dark:text-[#F1F5FB]">
                    گام چهارم: ثبت دانش‌آموزان و تعریف و اتصال اولیا
                  </h3>
                  <p className="text-xs text-[#526176] dark:text-[#B3C0D2]">
                    هر دانش‌آموز به یک کلاس متصل شده و اولیای قانونی با دسترسی‌های تفکیک‌شده ثبت می‌گردند
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsAddStudentModalOpen(true)}
                  icon={<UserPlus size={16} />}
                >
                  ثبت دانش‌آموز و اولیا
                </Button>
              </div>

              {/* Students & Parents List */}
              <div className="space-y-3">
                {studentsList.map((std, idx) => (
                  <div
                    key={std.id}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 flex items-center justify-center font-bold shrink-0">
                        {toPersianDigits(idx + 1)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-[#202B3C] dark:text-[#F1F5FB]">{std.fullName}</h4>
                          <Badge variant="neutral">{std.className}</Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          کد ملی: <span className="font-mono tabular-nums">{toPersianDigits(std.nationalId)}</span> · شماره دانش‌آموزی: <span className="font-mono tabular-nums">{toPersianDigits(std.studentNumber)}</span>
                        </p>
                      </div>
                    </div>

                    {/* Linked Parent Box */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center font-bold shrink-0">
                        <HeartHandshake size={16} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{std.parentFullName}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                            {std.parentRelation === 'father' ? 'پدر' : std.parentRelation === 'mother' ? 'مادر' : 'سرپرست قانونی'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">
                          تلفن: {toPersianDigits(std.parentPhone)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveStudent(std.id)}
                      className="text-slate-400 hover:text-red-500 p-1.5 transition-colors self-end md:self-center"
                      title="حذف دانش‌آموز"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              {studentsList.length === 0 && (
                <div className="p-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed">
                  هنوز دانش‌آموزی اضافه نشده است. می‌توانید با زدن دکمه بالا، دانش‌آموزان نمونه یا جدید را به کلاس‌ها منتسب کنید.
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-[#DCE3EE] dark:border-[#334155]">
                <Button variant="outline" onClick={() => setCurrentStep(3)} icon={<ArrowRight size={16} />}>
                  بازگشت به کلاس‌ها
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setCurrentStep(5)}
                  icon={<ArrowLeft size={16} />}
                >
                  گام بعدی: بازبینی نهایی و راه‌اندازی
                </Button>
              </div>
            </Card>
          )}

          {/* STEP 5: Final Review & Provisioning */}
          {currentStep === 5 && (
            <Card className="space-y-6">
              <div className="border-b border-[#DCE3EE] dark:border-[#334155] pb-4">
                <div className="flex items-center gap-2">
                  <Badge variant="primary">گام پایانی</Badge>
                  <h3 className="text-base font-bold text-[#202B3C] dark:text-[#F1F5FB]">
                    بازبینی شناسنامه و تأیید راه‌اندازی مدرسه در پلتفرم
                  </h3>
                </div>
                <p className="text-xs text-[#526176] dark:text-[#B3C0D2] mt-1">
                  لطفاً خلاصه‌ی ساختار سازمانی، کادر، کلاس‌ها و دانش‌آموزان را بازبینی و دستور راه‌اندازی را صادر فرمایید
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* School Summary Box */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2">
                  <h4 className="font-bold text-sm text-[#2457C5] dark:text-[#8BAEFF] flex items-center gap-2">
                    <Building2 size={16} />
                    شناسنامه واحد آموزشی
                  </h4>
                  <div className="space-y-1.5 pt-1 text-slate-600 dark:text-slate-300">
                    <div className="flex justify-between">
                      <span>نام واحد:</span>
                      <strong className="text-[#202B3C] dark:text-[#F1F5FB]">{schoolName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>کد مدرسه:</span>
                      <strong className="font-mono">{schoolCode}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>نوع و دوره:</span>
                      <span>{schoolType} ({schoolBranch})</span>
                    </div>
                    <div className="flex justify-between">
                      <span>موقعیت:</span>
                      <span>{schoolProvince} — {schoolCity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>سال تحصیلی:</span>
                      <strong>{schoolAcademicYear}</strong>
                    </div>
                  </div>
                </div>

                {/* Operations Summary */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2">
                  <h4 className="font-bold text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <Shield size={16} />
                    خلاصه ساختار انسانی و کلاسی
                  </h4>
                  <div className="space-y-1.5 pt-1 text-slate-600 dark:text-slate-300">
                    <div className="flex justify-between">
                      <span>تعداد اعضای کادر:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400">{toPersianDigits(staffList.length)} نفر</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>تعداد کلاس‌های فعال:</span>
                      <strong>{toPersianDigits(classroomsList.length)} کلاس</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>دانش‌آموزان ثبت‌نامی:</span>
                      <strong>{toPersianDigits(studentsList.length)} نفر</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>اولیای متصل دارای حساب:</span>
                      <strong>{toPersianDigits(studentsList.length)} حساب ولی</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>مدیر ارشد واحد:</span>
                      <strong className="text-[#202B3C] dark:text-[#F1F5FB]">
                        {staffList.find((s) => s.roleId === 'school_principal')?.fullName || 'دکتر احمدرضا جلالی'}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Legal and Security Note */}
              <div className="p-4 rounded-2xl bg-blue-50/80 text-blue-950 dark:bg-blue-950/40 dark:text-blue-200 border border-blue-200 dark:border-blue-900/50 text-xs leading-relaxed flex items-start gap-3">
                <Shield size={18} className="shrink-0 mt-0.5 text-[#2457C5] dark:text-[#8BAEFF]" />
                <div>
                  <strong className="font-bold block">ممیزی امنیتی و صدور شناسنامه پلتفرم:</strong>
                  با کلیک بر روی دکمه زیر، دیتابیس مدرسه ایجاد شده، تمامی کادر و اولیا به عنوان کاربر سیستم تعریف می‌شوند، نقش‌ها و مجوزها اختصاص یافته و شناسه رسمی برای مدرسه صادر خواهد شد.
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-[#DCE3EE] dark:border-[#334155]">
                <Button variant="outline" onClick={() => setCurrentStep(4)} icon={<ArrowRight size={16} />}>
                  بازگشت و اصلاح دانش‌آموزان
                </Button>
                <Button
                  variant="primary"
                  onClick={handleFinalLaunch}
                  loading={isProvisioning}
                  icon={<Sparkles size={16} />}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                >
                  تأیید نهایی و تأسیس مدرسه در پلتفرم
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ---------------- MODAL: Add Staff Member ---------------- */}
      <Modal
        isOpen={isAddStaffModalOpen}
        onClose={() => setIsAddStaffModalOpen(false)}
        title="انتصاب یا ایجاد عضو جدید کادر مدرسه"
      >
        <div className="space-y-4 text-xs text-right">
          {/* Mode Switcher */}
          <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800 flex gap-1">
            <button
              onClick={() => setStaffMode('existing')}
              className={cn(
                'flex-1 py-1.5 rounded-lg font-bold transition-all',
                staffMode === 'existing'
                  ? 'bg-white dark:bg-slate-700 text-[#2457C5] dark:text-[#8BAEFF] shadow-xs'
                  : 'text-slate-500'
              )}
            >
              انتخاب از کاربران موجود در سیستم
            </button>
            <button
              onClick={() => setStaffMode('new')}
              className={cn(
                'flex-1 py-1.5 rounded-lg font-bold transition-all',
                staffMode === 'new'
                  ? 'bg-white dark:bg-slate-700 text-[#2457C5] dark:text-[#8BAEFF] shadow-xs'
                  : 'text-slate-500'
              )}
            >
              ایجاد کاربر جدید
            </button>
          </div>

          {staffMode === 'existing' ? (
            <FormField label="انتخاب کاربر از فهرست سامانه *">
              <select
                value={selectedExistingUserId}
                onChange={(e) => setSelectedExistingUserId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} — کد ملی: {u.nationalId} ({u.phoneNumber})
                  </option>
                ))}
              </select>
            </FormField>
          ) : (
            <div className="space-y-3">
              <FormField label="نام و نام خانوادگی *" required>
                <input
                  type="text"
                  value={newStaffFullName}
                  onChange={(e) => setNewStaffFullName(e.target.value)}
                  placeholder="مثال: دکتر علیرضا بهرامی"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-2">
                <FormField label="کد ملی ۱۰ رقمی *" required>
                  <input
                    type="text"
                    value={newStaffNationalId}
                    onChange={(e) => setNewStaffNationalId(e.target.value)}
                    placeholder="۰۰۱۴۵۸۹۶۲۱"
                    className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </FormField>
                <FormField label="تلفن همراه *">
                  <input
                    type="text"
                    value={newStaffPhone}
                    onChange={(e) => setNewStaffPhone(e.target.value)}
                    placeholder="۰۹۱۲۱۱۱۱۱۱۱"
                    className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </FormField>
              </div>
              <FormField label="پست الکترونیک سازمانی">
                <input
                  type="email"
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  placeholder="staff@mashahir.sch.ir"
                  className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </FormField>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-2">
            <FormField label="سمت و نقش سازمانی *">
              <select
                value={newStaffRole}
                onChange={(e) => setNewStaffRole(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                {roleOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="درس یا تخصص (اختیاری)">
              <input
                type="text"
                value={newStaffSubject}
                onChange={(e) => setNewStaffSubject(e.target.value)}
                placeholder="مثال: فیزیک، مشاوره، حسابان"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setIsAddStaffModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" size="sm" onClick={handleAddStaff} icon={<Check size={16} />}>
              افزودن به کادر مدرسه
            </Button>
          </div>
        </div>
      </Modal>

      {/* ---------------- MODAL: Add Classroom ---------------- */}
      <Modal
        isOpen={isAddClassModalOpen}
        onClose={() => setIsAddClassModalOpen(false)}
        title="تعریف کلاس درس جدید"
      >
        <div className="space-y-4 text-xs text-right">
          <FormField label="عنوان کلاس *" required>
            <input
              type="text"
              value={classNameInput}
              onChange={(e) => setClassNameInput(e.target.value)}
              placeholder="مثال: کلاس ۱۰۳ (دهم انسانی)"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-2">
            <FormField label="پایه تحصیلی">
              <select
                value={classGradeInput}
                onChange={(e) => setClassGradeInput(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="پایه دهم">پایه دهم</option>
                <option value="پایه یازدهم">پایه یازدهم</option>
                <option value="پایه دوازدهم">پایه دوازدهم</option>
              </select>
            </FormField>

            <FormField label="رشته تحصیلی">
              <select
                value={classFieldInput}
                onChange={(e) => setClassFieldInput(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="ریاضی و فیزیک">ریاضی و فیزیک</option>
                <option value="علوم تجربی">علوم تجربی</option>
                <option value="ادبیات و علوم انسانی">ادبیات و علوم انسانی</option>
                <option value="فنی و حرفه‌ای">فنی و حرفه‌ای</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <FormField label="شماره اتاق / فضا">
              <input
                type="text"
                value={classRoomInput}
                onChange={(e) => setClassRoomInput(e.target.value)}
                placeholder="مثال: ۱۰۳"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </FormField>

            <FormField label="ظرفیت صندلی (نفر)">
              <input
                type="number"
                value={classCapacityInput}
                onChange={(e) => setClassCapacityInput(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </FormField>
          </div>

          <FormField label="دبیر راهنما / معلم مسئول کلاس">
            <select
              value={classHeadTeacherStaffId}
              onChange={(e) => setClassHeadTeacherStaffId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.roleTitle})
                </option>
              ))}
            </select>
          </FormField>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setIsAddClassModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" size="sm" onClick={handleAddClassroom} icon={<Check size={16} />}>
              ثبت کلاس درس
            </Button>
          </div>
        </div>
      </Modal>

      {/* ---------------- MODAL: Add Student & Parent ---------------- */}
      <Modal
        isOpen={isAddStudentModalOpen}
        onClose={() => setIsAddStudentModalOpen(false)}
        title="ثبت‌نام دانش‌آموز جدید و تعریف اولیا"
      >
        <div className="space-y-4 text-xs text-right max-h-[75vh] overflow-y-auto px-1">
          {/* Student Info */}
          <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200/60 dark:border-blue-900/40 space-y-3">
            <strong className="text-sm font-bold text-[#2457C5] dark:text-[#8BAEFF] flex items-center gap-2">
              <GraduationCap size={16} />
              مشخصات دانش‌آموز
            </strong>

            <FormField label="نام و نام خانوادگی دانش‌آموز *" required>
              <input
                type="text"
                value={stdName}
                onChange={(e) => setStdName(e.target.value)}
                placeholder="مثال: پارسا رادمنش"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-2">
              <FormField label="کد ملی دانش‌آموز *" required>
                <input
                  type="text"
                  value={stdNationalId}
                  onChange={(e) => setStdNationalId(e.target.value)}
                  placeholder="۰۱۴۵۶۷۸۹۰۱"
                  className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </FormField>

              <FormField label="شماره دانش‌آموزی">
                <input
                  type="text"
                  value={stdNumber}
                  onChange={(e) => setStdNumber(e.target.value)}
                  placeholder="۴۰۴۱۰۱"
                  className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <FormField label="کلاس انتسابی *">
                <select
                  value={stdClassroomId}
                  onChange={(e) => setStdClassroomId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  {classroomsList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.grade})
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="تاریخ تولد">
                <input
                  type="text"
                  value={stdBirthDate}
                  onChange={(e) => setStdBirthDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </FormField>
            </div>
          </div>

          {/* Parent Info & Permissions */}
          <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 space-y-3">
            <strong className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <HeartHandshake size={16} />
              مشخصات و دسترسی‌های اولیای دانش‌آموز (پدر / مادر / قیم)
            </strong>

            <div className="grid grid-cols-2 gap-2">
              <FormField label="نسبت با دانش‌آموز *">
                <select
                  value={parentRelation}
                  onChange={(e) => setParentRelation(e.target.value as GuardianRelationshipType)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="father">پدر</option>
                  <option value="mother">مادر</option>
                  <option value="legal_guardian">سرپرست قانونی (قیم)</option>
                </select>
              </FormField>

              <FormField label="نام و نام خانوادگی ولی *" required>
                <input
                  type="text"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  placeholder="مثال: فریبا کاظمی"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <FormField label="کد ملی ولی *" required>
                <input
                  type="text"
                  value={parentNationalId}
                  onChange={(e) => setParentNationalId(e.target.value)}
                  placeholder="۰۰۳۴۵۶۷۸۹۰"
                  className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </FormField>

              <FormField label="شماره تلفن همراه ولی *" required>
                <input
                  type="text"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                  className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </FormField>
            </div>

            {/* Granular Permissions Checkboxes */}
            <div className="pt-2 border-t border-emerald-200/50 dark:border-emerald-800/50 space-y-1.5">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                سطوح دسترسی ولی در پورتال خانواده:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={parentReport}
                    onChange={(e) => setParentReport(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <span>مشاهده کارنامه و نمرات تحصیلی</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={parentAttendance}
                    onChange={(e) => setParentAttendance(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <span>مشاهده گزارش حضور و غیاب</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={parentSms}
                    onChange={(e) => setParentSms(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <span>دریافت پیامک‌های تردد و انضباطی</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={parentConsent}
                    onChange={(e) => setParentConsent(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <span>امضای الکترونیکی رضایت‌نامه‌ها</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={parentPickup}
                    onChange={(e) => setParentPickup(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <span>مجوز تحویل فیزیکی از گیت مدرسه</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setIsAddStudentModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" size="sm" onClick={handleAddStudent} icon={<Check size={16} />}>
              ثبت دانش‌آموز و ایجاد پیوند اولیا
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
