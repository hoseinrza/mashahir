import {
  INITIAL_SCHOOL, INITIAL_SCHOOLS, INITIAL_USERS, INITIAL_ROLE_ASSIGNMENTS, INITIAL_CLASSROOMS,
  INITIAL_STUDENTS, INITIAL_GUARDIAN_LINKS, INITIAL_LEGAL_RESTRICTIONS,
  INITIAL_AUTHORIZED_PICKUPS, INITIAL_ATTENDANCE, INITIAL_ASSIGNMENTS,
  INITIAL_SUBMISSIONS, INITIAL_EXAMS, INITIAL_REPORT_CARDS,
  INITIAL_COUNSELING_APPOINTMENTS, INITIAL_ANNOUNCEMENTS, INITIAL_NOTIFICATIONS,
  INITIAL_PTA_MEETINGS, INITIAL_SURVEYS, INITIAL_FEEDBACKS, INITIAL_AUDIT_LOGS,
  INITIAL_CONSENT_FORMS, INITIAL_WEEKLY_TIMETABLE, INITIAL_ONLINE_CLASSES, INITIAL_BUS_ROUTES
} from '../data/mockData';

import {
  AttendanceRecord, Assignment, Submission, Exam, ExamAttempt,
  GuardianStudentLink, LegalRestriction, AuthorizedPickup,
  CounselingAppointment, Announcement, Notification, Survey, FeedbackItem,
  AuditEvent, ConsentForm, Role, RoleAssignment, User, CommitteeMeeting,
  OnlineClassSession, OnlineClassAttendance, WeeklyTimetableSlot,
  School, Student, Classroom, BusRoute, GuardianRelationshipType
} from '../types';
import { BASE_ROLES } from '../permissions';

function getStorage<T>(key: string, initial: T): T {
  try {
    const raw = localStorage.getItem(`mashahir_${key}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(`Error reading ${key} from storage:`, e);
  }
  return initial;
}

function setStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`mashahir_${key}`, JSON.stringify(value));
  } catch (e) {
    console.error(`Error writing ${key} to storage:`, e);
  }
}

// Attendance Service
export const AttendanceService = {
  getAll: (): AttendanceRecord[] => getStorage('attendance', INITIAL_ATTENDANCE),
  getByClassAndDate: (classId: string, date: string): AttendanceRecord[] => {
    const list = AttendanceService.getAll();
    return list.filter((a) => a.classroomId === classId && a.date === date);
  },
  saveRecords: (records: AttendanceRecord[], actorName: string, reason?: string) => {
    const all = AttendanceService.getAll();
    const updated = [...all];
    records.forEach((rec) => {
      const idx = updated.findIndex((a) => a.id === rec.id);
      if (idx >= 0) {
        updated[idx] = { ...rec, lastModifiedBy: actorName, lastModifiedReason: reason || updated[idx].lastModifiedReason };
      } else {
        updated.push(rec);
      }
    });
    setStorage('attendance', updated);
    if (reason) {
      AuditService.log({
        actorId: 'active_actor',
        actorName,
        actorRole: 'ثبت‌کننده حضور و غیاب',
        action: 'تغییر و بازبینی حضور و غیاب',
        entityType: 'attendance',
        entityId: records[0]?.id || 'batch',
        description: `به‌روزرسانی رکوردهای کلاس برای ${records.length} دانش‌آموز`,
        reason,
      });
    }
    return updated;
  },
  getAttendance: (classSessionId: string): OnlineClassAttendance[] => {
    return getStorage<OnlineClassAttendance[]>(`online_att_${classSessionId}`, []);
  },
  recordAttendance: (record: Omit<OnlineClassAttendance, 'id'>): OnlineClassAttendance => {
    const list = getStorage<OnlineClassAttendance[]>(`online_att_${record.classSessionId}`, []);
    const newRecord: OnlineClassAttendance = {
      ...record,
      id: `oatt_${Date.now()}`,
    };
    const updated = [newRecord, ...list.filter((r) => r.studentId !== record.studentId)];
    setStorage(`online_att_${record.classSessionId}`, updated);
    return newRecord;
  },
};

// Assignment & Submissions Service
export const AssignmentService = {
  getAssignments: (): Assignment[] => getStorage('assignments', INITIAL_ASSIGNMENTS),
  getSubmissions: (): Submission[] => getStorage('submissions', INITIAL_SUBMISSIONS),
  createAssignment: (asg: Omit<Assignment, 'id' | 'createdAt'>, teacherName: string): Assignment => {
    const all = AssignmentService.getAssignments();
    const newAsg: Assignment = {
      ...asg,
      id: `asg_${Date.now()}`,
      createdAt: '۱۴۰۳/۰۷/۲۲',
    };
    setStorage('assignments', [newAsg, ...all]);
    AuditService.log({
      actorId: asg.teacherId,
      actorName: teacherName,
      actorRole: 'دبیر',
      action: 'تعریف تکلیف جدید',
      entityType: 'grade',
      entityId: newAsg.id,
      description: `تعریف تکلیف ${newAsg.title} برای ${newAsg.className}`,
    });
    return newAsg;
  },
  submitAssignment: (sub: Omit<Submission, 'id' | 'submissionDate' | 'status'>): Submission => {
    const all = AssignmentService.getSubmissions();
    const newSub: Submission = {
      ...sub,
      id: `sub_${Date.now()}`,
      submissionDate: 'هم‌اکنون',
      status: 'submitted',
    };
    const updated = [newSub, ...all.filter((s) => !(s.assignmentId === sub.assignmentId && s.studentId === sub.studentId))];
    setStorage('submissions', updated);
    return newSub;
  },
  gradeSubmission: (subId: string, score: number, feedback: string, teacherName: string, reason?: string) => {
    const all = AssignmentService.getSubmissions();
    const updated = all.map((s) => {
      if (s.id === subId) {
        return {
          ...s,
          score,
          feedback,
          status: 'graded' as const,
          gradedBy: teacherName,
          gradedAt: 'امروز، ۱۱:۰۰',
        };
      }
      return s;
    });
    setStorage('submissions', updated);
    AuditService.log({
      actorId: 'active_teacher',
      actorName: teacherName,
      actorRole: 'دبیر',
      action: 'ثبت / اصلاح نمره تکلیف',
      entityType: 'grade',
      entityId: subId,
      description: `ثبت نمره ${score} برای تکلیف`,
      reason: reason || 'تصحیح برگه ارسالی دانش‌آموز',
    });
    return updated;
  },
};

// Exam Service
export const ExamService = {
  getExams: (): Exam[] => getStorage('exams', INITIAL_EXAMS),
  getAttempts: (): ExamAttempt[] => getStorage('exam_attempts', []),
  saveAttempt: (attempt: ExamAttempt) => {
    const all = ExamService.getAttempts();
    const updated = [...all.filter((a) => !(a.examId === attempt.examId && a.studentId === attempt.studentId)), attempt];
    setStorage('exam_attempts', updated);
    return attempt;
  },
  createExam: (exam: Omit<Exam, 'id'>, actorName: string): Exam => {
    const all = ExamService.getExams();
    const newExam: Exam = {
      ...exam,
      id: `ex_${Date.now()}`,
    };
    const updated = [newExam, ...all];
    setStorage('exams', updated);
    AuditService.log({
      actorId: exam.teacherId || 'creator',
      actorName,
      actorRole: 'طراح آزمون / کادر آموزشی',
      action: 'طراحی و انتشار آزمون آنلاین',
      entityType: 'exam',
      entityId: newExam.id,
      description: `طراحی آزمون جدید «${newExam.title}» برای درس ${newExam.subject}`,
    });
    return newExam;
  },
  gradeEssayQuestion: (examId: string, studentId: string, questionId: string, score: number, feedback: string, graderName: string) => {
    const attempts = ExamService.getAttempts();
    const updated = attempts.map((att) => {
      if (att.examId === examId && att.studentId === studentId) {
        const answers = att.answers.map((ans) => {
          if (ans.questionId === questionId) {
            return { ...ans, scoreAwarded: score, feedback };
          }
          return ans;
        });
        const manualScore = answers.reduce((acc, a) => acc + (a.scoreAwarded || 0), 0);
        const finalScore = (att.autoScore || 0) + manualScore;
        return { ...att, answers, manualScore, finalScore };
      }
      return att;
    });
    setStorage('exam_attempts', updated);
    AuditService.log({
      actorId: 'grader_id',
      actorName: graderName,
      actorRole: 'مصحح آزمون',
      action: 'تصحیح پاسخ تشریحی آزمون',
      entityType: 'exam',
      entityId: `${examId}_${questionId}`,
      description: `ثبت نمره تشریحی ${score} برای دانش‌آموز`,
    });
    return updated;
  },
};

// Family Relations, Custody & Pickup Service
export const FamilyService = {
  getLinks: (): GuardianStudentLink[] => getStorage('guardian_links', INITIAL_GUARDIAN_LINKS),
  getRestrictions: (): LegalRestriction[] => getStorage('legal_restrictions', INITIAL_LEGAL_RESTRICTIONS),
  getPickups: (): AuthorizedPickup[] => getStorage('authorized_pickups', INITIAL_AUTHORIZED_PICKUPS),
  updateLinkPermissions: (linkId: string, permissions: Partial<GuardianStudentLink>, actorName: string, reason: string) => {
    const all = FamilyService.getLinks();
    const updated = all.map((l) => {
      if (l.id === linkId) {
        return {
          ...l,
          ...permissions,
          updatedAt: 'امروز',
          updatedBy: actorName,
        };
      }
      return l;
    });
    setStorage('guardian_links', updated);
    AuditService.log({
      actorId: 'admin_id',
      actorName,
      actorRole: 'مسئول دفتر و ثبت‌نام',
      action: 'اصلاح مجوز رابطه ولی-دانش‌آموز',
      entityType: 'family_link',
      entityId: linkId,
      description: `تغییر دسترسی‌های ولی در رابطه خانوادگی`,
      reason,
    });
    return updated;
  },
  createLink: (link: Omit<GuardianStudentLink, 'id'>, actorName: string): GuardianStudentLink => {
    const all = FamilyService.getLinks();
    const newLink: GuardianStudentLink = {
      ...link,
      id: `lnk_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      validFrom: link.validFrom || '۱۴۰۳/۰۷/۰۱',
      verificationStatus: link.verificationStatus || 'verified',
      updatedAt: 'هم‌اکنون',
      updatedBy: actorName,
    };
    const updated = [newLink, ...all];
    setStorage('guardian_links', updated);
    AuditService.log({
      actorId: 'admin_id',
      actorName,
      actorRole: 'ثبت‌نام و مدیریت خانواده',
      action: 'ایجاد رابطه ولی و دانش‌آموز',
      entityType: 'family_link',
      entityId: newLink.id,
      description: `پیوند ولی «${newLink.guardianName}» به دانش‌آموز «${newLink.studentName}»`,
    });
    return newLink;
  },
  createGuardianAndLink: (
    params: {
      guardianName: string;
      guardianPhone: string;
      guardianNationalId: string;
      guardianEmail?: string;
      studentId: string;
      studentName: string;
      relationshipType: GuardianRelationshipType;
      canViewAcademicReport?: boolean;
      canViewAttendance?: boolean;
      canReceiveSmsNotifications?: boolean;
      canSignConsentForms?: boolean;
      canBookCounseling?: boolean;
      canPickupStudent?: boolean;
      notes?: string;
    },
    actorName: string
  ): { user: User; link: GuardianStudentLink } => {
    const existingUsers = UserService.getUsers();
    let guardianUser = existingUsers.find((u) => u.nationalId === params.guardianNationalId);
    if (!guardianUser) {
      guardianUser = UserService.createUser(
        {
          nationalId: params.guardianNationalId,
          fullName: params.guardianName,
          phoneNumber: params.guardianPhone,
          email: params.guardianEmail || `${params.guardianNationalId}@mashahir.sch.ir`,
          isActive: true,
        },
        actorName
      );
    }

    UserService.assignRole({
      userId: guardianUser.id,
      roleId: 'parent_legal_custody',
      schoolId: 'sch_1',
      scopeType: 'guardian_link',
      scopeId: params.studentId,
      validFrom: '۱۴۰۳/۰۷/۰۱',
    });

    const newLink = FamilyService.createLink(
      {
        guardianUserId: guardianUser.id,
        guardianName: params.guardianName,
        guardianPhone: params.guardianPhone,
        guardianNationalId: params.guardianNationalId,
        studentId: params.studentId,
        studentName: params.studentName,
        relationshipType: params.relationshipType,
        verificationStatus: 'verified',
        validFrom: '۱۴۰۳/۰۷/۰۱',
        canViewAcademicReport: params.canViewAcademicReport ?? true,
        canViewAttendance: params.canViewAttendance ?? true,
        canReceiveSmsNotifications: params.canReceiveSmsNotifications ?? true,
        canSignConsentForms: params.canSignConsentForms ?? true,
        canBookCounseling: params.canBookCounseling ?? true,
        canPickupStudent: params.canPickupStudent ?? true,
        hasLegalRestriction: false,
        notes: params.notes || 'ثبت در زمان تعریف دانش‌آموز',
        updatedAt: 'هم‌اکنون',
        updatedBy: actorName,
      },
      actorName
    );

    return { user: guardianUser, link: newLink };
  },
  addLegalRestriction: (restriction: Omit<LegalRestriction, 'id' | 'registeredDate'>, actorName: string) => {
    const all = FamilyService.getRestrictions();
    const newRes: LegalRestriction = {
      ...restriction,
      id: `lr_${Date.now()}`,
      registeredDate: '۱۴۰۳/۰۷/۲۲',
    };
    setStorage('legal_restrictions', [newRes, ...all]);

    // Update corresponding link
    const links = FamilyService.getLinks().map((l) => {
      if (l.studentId === restriction.studentId && l.guardianUserId === restriction.restrictedGuardianUserId) {
        return {
          ...l,
          hasLegalRestriction: true,
          legalRestrictionId: newRes.id,
          canPickupStudent: false,
          notes: `محدودیت قضایی ثبت شد (دادنامه ${restriction.courtOrderNumber})`,
          updatedAt: 'هم‌اکنون',
          updatedBy: actorName,
        };
      }
      return l;
    });
    setStorage('guardian_links', links);

    AuditService.log({
      actorId: 'legal_registrar',
      actorName,
      actorRole: 'مسئول ثبت‌نام و مدیر مدرسه',
      action: 'ثبت و اعمال محدودیت قضایی دادگاه خانواده',
      entityType: 'legal_restriction',
      entityId: newRes.id,
      description: `ثبت دادنامه شماره ${newRes.courtOrderNumber} و محدودسازی تحویل فیزیکی`,
      reason: newRes.restrictionSummary,
    });
    return newRes;
  },
  addAuthorizedPickup: (pickup: Omit<AuthorizedPickup, 'id'>, actorName: string) => {
    const all = FamilyService.getPickups();
    const newPickup: AuthorizedPickup = {
      ...pickup,
      id: `pk_${Date.now()}`,
    };
    setStorage('authorized_pickups', [newPickup, ...all]);
    AuditService.log({
      actorId: pickup.registeredByGuardianId,
      actorName,
      actorRole: 'ولی دانش‌آموز',
      action: 'معرفی شخص مجاز ترخیص و تحویل دانش‌آموز',
      entityType: 'family_link',
      entityId: newPickup.id,
      description: `معرفی ${newPickup.fullName} (${newPickup.relationDescription}) جهت تحویل دانش‌آموز`,
    });
    return newPickup;
  },
};

// Counseling Service
export const CounselingService = {
  getAppointments: (): CounselingAppointment[] => getStorage('counseling', INITIAL_COUNSELING_APPOINTMENTS),
  bookAppointment: (apt: Omit<CounselingAppointment, 'id' | 'status'>): CounselingAppointment => {
    const all = CounselingService.getAppointments();
    const newApt: CounselingAppointment = {
      ...apt,
      id: `cns_${Date.now()}`,
      status: 'pending',
    };
    setStorage('counseling', [newApt, ...all]);
    return newApt;
  },
  updateAppointment: (id: string, updates: Partial<CounselingAppointment>) => {
    const all = CounselingService.getAppointments();
    const updated = all.map((a) => (a.id === id ? { ...a, ...updates } : a));
    setStorage('counseling', updated);
    return updated;
  },
};

// PTA & Surveys Service
export const PtaService = {
  getMeetings: (): CommitteeMeeting[] => getStorage('pta_meetings', INITIAL_PTA_MEETINGS),
  getSurveys: (): Survey[] => getStorage('pta_surveys', INITIAL_SURVEYS),
  getFeedbacks: (): FeedbackItem[] => getStorage('pta_feedbacks', INITIAL_FEEDBACKS),
  voteSurvey: (surveyId: string, optionId: string, userVoterId: string): Survey[] => {
    const surveys = PtaService.getSurveys();
    const updated = surveys.map((s) => {
      if (s.id === surveyId) {
        // Prevent duplicate voting check
        const options = s.options.map((opt) => {
          if (opt.id === optionId) {
            return { ...opt, votesCount: opt.votesCount + 1 };
          }
          return opt;
        });
        return {
          ...s,
          options,
          userVotedOptionId: optionId,
        };
      }
      return s;
    });
    setStorage('pta_surveys', updated);
    return updated;
  },
  submitFeedback: (fb: Omit<FeedbackItem, 'id' | 'submittedDate' | 'status'>): FeedbackItem => {
    const all = PtaService.getFeedbacks();
    const newFb: FeedbackItem = {
      ...fb,
      id: `fb_${Date.now()}`,
      submittedDate: 'هم‌اکنون',
      status: 'under_review',
    };
    setStorage('pta_feedbacks', [newFb, ...all]);
    return newFb;
  },
  respondFeedback: (fbId: string, response: string, responderName: string) => {
    const all = PtaService.getFeedbacks();
    const updated = all.map((f) => {
      if (f.id === fbId) {
        return {
          ...f,
          status: 'responded' as const,
          schoolResponse: response,
          respondedBy: responderName,
          respondedAt: 'امروز',
        };
      }
      return f;
    });
    setStorage('pta_feedbacks', updated);
    return updated;
  },
};

// Announcements & Notifications
export const AnnouncementService = {
  getAll: (): Announcement[] => getStorage('announcements', INITIAL_ANNOUNCEMENTS),
  create: (ann: Omit<Announcement, 'id' | 'publishedDate'>): Announcement => {
    const all = AnnouncementService.getAll();
    const newAnn: Announcement = {
      ...ann,
      id: `ann_${Date.now()}`,
      publishedDate: 'هم‌اکنون',
    };
    setStorage('announcements', [newAnn, ...all]);
    return newAnn;
  },
};

export const NotificationService = {
  getAll: (): Notification[] => getStorage('notifications', INITIAL_NOTIFICATIONS),
  markAsRead: (id: string) => {
    const all = NotificationService.getAll();
    const updated = all.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    setStorage('notifications', updated);
    return updated;
  },
  markAllAsRead: () => {
    const all = NotificationService.getAll();
    const updated = all.map((n) => ({ ...n, isRead: true }));
    setStorage('notifications', updated);
    return updated;
  },
};

// Audit Log Service
export const AuditService = {
  getAll: (): AuditEvent[] => getStorage('audit_logs', INITIAL_AUDIT_LOGS),
  log: (event: Omit<AuditEvent, 'id' | 'timestamp'>) => {
    const all = AuditService.getAll();
    const newEvent: AuditEvent = {
      ...event,
      id: `aud_${Date.now()}`,
      timestamp: '۱۴۰۳/۰۷/۲۲ - ۱۲:۰۰',
    };
    setStorage('audit_logs', [newEvent, ...all]);
    return newEvent;
  },
};

// Consent Forms Service
export const ConsentService = {
  getAll: (): ConsentForm[] => getStorage('consent_forms', INITIAL_CONSENT_FORMS),
  signForm: (formId: string, guardianName: string, status: 'approved' | 'rejected') => {
    const all = ConsentService.getAll();
    const updated = all.map((f) => {
      if (f.id === formId) {
        return {
          ...f,
          status,
          signedByGuardianName: guardianName,
          signedAt: 'هم‌اکنون',
        };
      }
      return f;
    });
    setStorage('consent_forms', updated);
    return updated;
  },
  createForm: (form: Omit<ConsentForm, 'id'>, actorName: string): ConsentForm => {
    const all = ConsentService.getAll();
    const newForm: ConsentForm = {
      ...form,
      id: `csf_${Date.now()}`,
    };
    const updated = [newForm, ...all];
    setStorage('consent_forms', updated);
    AuditService.log({
      actorId: 'staff',
      actorName,
      actorRole: 'کادر مدرسه',
      action: 'تعریف فرم رضایت‌نامه و اردوی جدید',
      entityType: 'permission',
      entityId: newForm.id,
      description: `ثبت اردوی جدید «${newForm.title}» به مقصد ${newForm.destination}`,
    });
    return newForm;
  },
};

// Users & Roles Management
export const UserService = {
  getUsers: (): User[] => getStorage('users', INITIAL_USERS),
  getRoleAssignments: (): RoleAssignment[] => getStorage('role_assignments', INITIAL_ROLE_ASSIGNMENTS),
  getRoles: (): Role[] => getStorage('roles', BASE_ROLES),
  saveCustomRole: (role: Role) => {
    const all = UserService.getRoles();
    const updated = [...all.filter((r) => r.id !== role.id), role];
    setStorage('roles', updated);
    return updated;
  },
  assignRole: (assignment: Omit<RoleAssignment, 'id'>) => {
    const all = UserService.getRoleAssignments();
    const newAssign: RoleAssignment = {
      ...assignment,
      id: `ra_${Date.now()}`,
    };
    const updated = [...all, newAssign];
    setStorage('role_assignments', updated);
    return updated;
  },
  createUser: (user: Omit<User, 'id' | 'createdAt'>, actorName: string): User => {
    const all = UserService.getUsers();
    const newUser: User = {
      ...user,
      id: `usr_${Date.now()}`,
      createdAt: '۱۴۰۳/۰۷/۱۵',
    };
    const updated = [newUser, ...all];
    setStorage('users', updated);
    AuditService.log({
      actorId: 'admin',
      actorName,
      actorRole: 'مدیر / معاون',
      action: 'ایجاد حساب کاربری',
      entityType: 'permission',
      entityId: newUser.id,
      description: `تعریف حساب کاربری «${newUser.fullName}» کدملی ${newUser.nationalId}`,
    });
    return newUser;
  },
  getStudents: (): Student[] => getStorage('students', INITIAL_STUDENTS),
  createStudent: (student: Omit<Student, 'id' | 'userId'>, actorName: string): Student => {
    const all = UserService.getStudents();
    const newId = `std_${Date.now()}`;
    const newStudent: Student = {
      ...student,
      id: newId,
      userId: `usr_${newId}`,
    };
    const updated = [newStudent, ...all];
    setStorage('students', updated);
    AuditService.log({
      actorId: 'academic_deputy',
      actorName,
      actorRole: 'معاون آموزشی / مدیر',
      action: 'ثبت‌نام دانش‌آموز جدید',
      entityType: 'family_link',
      entityId: newStudent.id,
      description: `ثبت‌نام دانش‌آموز «${newStudent.fullName}» در کلاس ${newStudent.classroomId}`,
    });
    return newStudent;
  },
};

// Multi-School Management Service (Platform Super Admin & Multi-Principal)
export const SchoolService = {
  getAll: (): School[] => getStorage('schools', INITIAL_SCHOOLS),
  getById: (id: string): School | undefined => {
    return SchoolService.getAll().find((s) => s.id === id);
  },
  createSchool: (school: Omit<School, 'id'>, actorName: string): School => {
    const all = SchoolService.getAll();
    const newSchool: School = {
      ...school,
      id: `sch_${Date.now()}`,
    };
    const updated = [...all, newSchool];
    setStorage('schools', updated);
    AuditService.log({
      actorId: 'platform_admin',
      actorName,
      actorRole: 'مدیر کل پلتفرم',
      action: 'تعریف و تأسیس مدرسه جدید',
      entityType: 'permission',
      entityId: newSchool.id,
      description: `ثبت واحد آموزشی جدید «${newSchool.name}» با کد ${newSchool.code}`,
    });
    return newSchool;
  },
  assignPrincipals: (schoolId: string, principalNames: string[], actorName: string): School[] => {
    const all = SchoolService.getAll();
    const updated = all.map((s) => {
      if (s.id === schoolId) {
        return {
          ...s,
          principalName: principalNames[0] || s.principalName,
          coPrincipals: principalNames,
        };
      }
      return s;
    });
    setStorage('schools', updated);
    AuditService.log({
      actorId: 'platform_admin',
      actorName,
      actorRole: 'مدیر کل پلتفرم',
      action: 'انتساب مدیران واحد آموزشی',
      entityType: 'permission',
      entityId: schoolId,
      description: `انتساب مدیران (${principalNames.join('، ')}) به مدرسه`,
    });
    return updated;
  },
};

// Classroom Management Service
export const ClassroomService = {
  getAll: (): Classroom[] => getStorage('classrooms', INITIAL_CLASSROOMS),
  getBySchool: (schoolId: string): Classroom[] => {
    return ClassroomService.getAll().filter((c) => c.schoolId === schoolId);
  },
  getById: (id: string): Classroom | undefined => {
    return ClassroomService.getAll().find((c) => c.id === id);
  },
  createClassroom: (classroom: Omit<Classroom, 'id'>, actorName: string): Classroom => {
    const all = ClassroomService.getAll();
    const newClassroom: Classroom = {
      ...classroom,
      id: `cls_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    };
    const updated = [...all, newClassroom];
    setStorage('classrooms', updated);
    AuditService.log({
      actorId: 'admin_id',
      actorName,
      actorRole: 'مدیر کل / معاون آموزشی',
      action: 'تعریف کلاس درس جدید',
      entityType: 'permission',
      entityId: newClassroom.id,
      description: `تعریف کلاس جدید «${newClassroom.name}» پایه ${newClassroom.grade}`,
    });
    return newClassroom;
  },
  updateClassroom: (id: string, updates: Partial<Classroom>): Classroom[] => {
    const all = ClassroomService.getAll();
    const updated = all.map((c) => (c.id === id ? { ...c, ...updates } : c));
    setStorage('classrooms', updated);
    return updated;
  },
  deleteClassroom: (id: string): Classroom[] => {
    const all = ClassroomService.getAll();
    const updated = all.filter((c) => c.id !== id);
    setStorage('classrooms', updated);
    return updated;
  },
};

// Transport & Bus Routes Service (Disciplinary Deputy)
export const BusService = {
  getRoutes: (): BusRoute[] => getStorage('bus_routes', INITIAL_BUS_ROUTES),
  createRoute: (route: Omit<BusRoute, 'id'>, actorName: string): BusRoute => {
    const all = BusService.getRoutes();
    const newRoute: BusRoute = {
      ...route,
      id: `rot_${Date.now()}`,
    };
    const updated = [...all, newRoute];
    setStorage('bus_routes', updated);
    AuditService.log({
      actorId: 'disciplinary_deputy',
      actorName,
      actorRole: 'معاون انضباطی',
      action: 'تعریف خط سرویس مدرسه',
      entityType: 'attendance',
      entityId: newRoute.id,
      description: `تعریف مسیر جدید سرویس «${newRoute.title}» به رانندگی ${newRoute.driverName}`,
    });
    return newRoute;
  },
  updateRoute: (id: string, updates: Partial<BusRoute>): BusRoute[] => {
    const all = BusService.getRoutes();
    const updated = all.map((r) => (r.id === id ? { ...r, ...updates } : r));
    setStorage('bus_routes', updated);
    return updated;
  },
};

// Weekly Timetable / Schedule Service
export const ScheduleService = {
  getAll: (): WeeklyTimetableSlot[] => getStorage('weekly_timetable', INITIAL_WEEKLY_TIMETABLE),
  getByClassroom: (classroomId: string): WeeklyTimetableSlot[] => {
    const all = ScheduleService.getAll();
    return all.filter((s) => s.classroomId === classroomId);
  },
  getByTeacher: (teacherId: string): WeeklyTimetableSlot[] => {
    const all = ScheduleService.getAll();
    return all.filter((s) => s.teacherId === teacherId);
  },
};

// Online Classes Service
export const OnlineClassService = {
  getAll: (): OnlineClassSession[] => getStorage('online_classes', INITIAL_ONLINE_CLASSES),
  getById: (id: string): OnlineClassSession | undefined => {
    const all = OnlineClassService.getAll();
    return all.find((c) => c.id === id);
  },
  getByClassroom: (classroomId: string): OnlineClassSession[] => {
    const all = OnlineClassService.getAll();
    return all.filter((c) => c.classroomId === classroomId);
  },
  createSession: (session: Omit<OnlineClassSession, 'id'>, actorName: string): OnlineClassSession => {
    const all = OnlineClassService.getAll();
    const newSession: OnlineClassSession = {
      ...session,
      id: `onl_${Date.now()}`,
    };
    const updated = [newSession, ...all];
    setStorage('online_classes', updated);
    AuditService.log({
      actorId: session.teacherId,
      actorName,
      actorRole: 'دبیر / مدیر',
      action: 'تعریف و برنامه‌ریزی کلاس آنلاین',
      entityType: 'online_class',
      entityId: newSession.id,
      description: `تعریف جلسه زنده «${newSession.title}» برای ${newSession.className}`,
    });
    return newSession;
  },
  updateSession: (id: string, updates: Partial<OnlineClassSession>, actorName: string): OnlineClassSession[] => {
    const all = OnlineClassService.getAll();
    const updated = all.map((c) => (c.id === id ? { ...c, ...updates } : c));
    setStorage('online_classes', updated);
    AuditService.log({
      actorId: 'active_actor',
      actorName,
      actorRole: 'دبیر / مدیر',
      action: 'به‌روزرسانی کلاس آنلاین',
      entityType: 'online_class',
      entityId: id,
      description: `تغییر وضعیت یا مشخصات جلسه کلاس آنلاین`,
    });
    return updated;
  },
  getAttendance: (classSessionId: string): OnlineClassAttendance[] => {
    return getStorage<OnlineClassAttendance[]>(`online_att_${classSessionId}`, []);
  },
  recordAttendance: (record: Omit<OnlineClassAttendance, 'id'>): OnlineClassAttendance => {
    const list = getStorage<OnlineClassAttendance[]>(`online_att_${record.classSessionId}`, []);
    const newRecord: OnlineClassAttendance = {
      ...record,
      id: `oatt_${Date.now()}`,
    };
    const updated = [newRecord, ...list.filter((r) => r.studentId !== record.studentId)];
    setStorage(`online_att_${record.classSessionId}`, updated);
    return newRecord;
  },
};

