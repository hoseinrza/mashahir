/**
 * Core domain types for Mashahir-e Ayandeh Unified School Management System
 */

// User accounts & authentication contexts
export interface User {
  id: string;
  nationalId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
}

export type PermissionScope = 
  | 'platform'
  | 'school'
  | 'classroom'
  | 'student'
  | 'guardian_link'
  | 'record';

export interface Permission {
  id: string;
  code: string; // e.g. 'grades:read', 'attendance:write', 'family:manage'
  name: string;
  category: 'educational' | 'administrative' | 'disciplinary' | 'counseling' | 'family' | 'system';
  scope: PermissionScope;
  description: string;
}

export interface Role {
  id: string;
  name: string;
  persianTitle: string;
  group: 'platform' | 'school_admin' | 'faculty' | 'support' | 'operations' | 'family' | 'student' | 'pta' | 'external' | 'custom';
  description: string;
  isCustom?: boolean;
  allowedPermissions: string[]; // permission codes
  defaultScope: PermissionScope;
}

export interface RoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  schoolId: string;
  scopeType: PermissionScope;
  scopeId?: string; // e.g. classId, studentId, or '*'
  validFrom: string;
  validUntil?: string; // for temporary roles, substitute teachers, interns
  isRevoked?: boolean;
}

export interface School {
  id: string;
  name: string;
  branch: string;
  code: string;
  academicYear: string;
  principalName: string;
  coPrincipals?: string[]; // Multiple principals supported without limits
  address: string;
  phone: string;
  capacity?: number;
}

export interface BusRoute {
  id: string;
  schoolId: string;
  lineCode: string; // e.g. 'خط ۱'
  title: string;
  driverName: string;
  driverPhone: string;
  driverNationalId?: string;
  vehicleModel: string;
  plateNumber: string;
  capacity: number;
  assignedStudentCount: number;
  stops: string[];
  morningDepartureTime: string;
  eveningDepartureTime: string;
  isActive: boolean;
}

// Student & Classes
export interface Classroom {
  id: string;
  schoolId: string;
  name: string;
  grade: string; // e.g. پایه دهم, پایه یازدهم
  field: string; // e.g. ریاضی و فیزیک, تجربی, انسانی
  roomNumber: string;
  headTeacherId: string;
  studentCount: number;
  capacity?: number;
}

export interface Student {
  id: string;
  userId: string;
  studentNumber: string;
  classroomId: string;
  nationalId: string;
  fullName: string;
  gender: 'male' | 'female';
  birthDate: string;
  enrollmentStatus: 'active' | 'guest' | 'transferred' | 'graduated';
  avatarUrl?: string;
}

// Family Relations, Custody & Divorced Parents Governance
export type GuardianRelationshipType = 
  | 'father' // پدر
  | 'mother' // مادر
  | 'legal_guardian' // سرپرست قانونی
  | 'temporary_delegate' // نماینده موقت
  | 'pickup_only'; // فقط مجاز تحویل

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'revoked';

export interface GuardianStudentLink {
  id: string;
  guardianUserId: string;
  guardianName: string;
  guardianPhone: string;
  guardianNationalId: string;
  studentId: string;
  studentName: string;
  relationshipType: GuardianRelationshipType;
  verificationStatus: VerificationStatus;
  verificationDocumentRef?: string;
  validFrom: string;
  validUntil?: string; // required for temporary_delegate
  // Specific granular permissions:
  canViewAcademicReport: boolean; // مشاهده کارنامه و نمرات
  canViewAttendance: boolean; // مشاهده حضور و غیاب
  canReceiveSmsNotifications: boolean; // دریافت پیامک و اعلان
  canSignConsentForms: boolean; // امضای رضایت‌نامه‌ها
  canBookCounseling: boolean; // رزرو و پیگیری مشاوره
  canPickupStudent: boolean; // تحویل فیزیکی دانش‌آموز از مدرسه
  // Legal Restriction flag:
  hasLegalRestriction: boolean;
  legalRestrictionId?: string;
  notes?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface LegalRestriction {
  id: string;
  studentId: string;
  restrictedGuardianUserId: string;
  courtOrderNumber: string; // شماره حکم یا دادنامه قضایی
  issuingAuthority: string; // مرجع صادرکننده حکم (مثلاً شعبه ۱۲ دادگاه خانواده)
  issueDate: string; // تاریخ صدور حکم
  registeredDate: string; // تاریخ ثبت در سامانه
  restrictionSummary: string; // شرح محدودیت
  restrictedPermissions: string[]; // مجوزهای سلب‌شده
  isEnforced: boolean;
  verifiedByRegistrarId: string;
  documentFileUrl?: string;
  auditHistory: {
    date: string;
    action: string;
    actor: string;
    reason: string;
  }[];
}

export interface AuthorizedPickup {
  id: string;
  studentId: string;
  fullName: string;
  nationalId: string;
  phoneNumber: string;
  relationDescription: string; // e.g. پدربزرگ، راننده شخصی، خاله
  photoUrl?: string;
  isAuthorized: boolean;
  expirationDate?: string;
  registeredByGuardianId: string;
  approvedBySchoolId?: string;
}

// Attendance
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceRecord {
  id: string;
  classroomId: string;
  studentId: string;
  studentName: string;
  date: string; // YYYY/MM/DD شمسی
  status: AttendanceStatus;
  delayMinutes?: number;
  note?: string;
  recordedByTeacherId: string;
  recordedAt: string;
  lastModifiedBy?: string;
  lastModifiedReason?: string;
  smsNotificationSent: boolean;
  smsSentTime?: string;
  smsError?: string;
}

// Assignments
export interface Assignment {
  id: string;
  classroomId: string;
  className: string;
  subject: string; // ریاضی، فیزیک، ادبیات
  title: string;
  description: string;
  teacherId: string;
  teacherName: string;
  dueDate: string;
  dueTime: string;
  maxScore: number;
  attachmentName?: string;
  createdAt: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  submissionDate: string;
  content: string;
  fileName?: string;
  score?: number;
  feedback?: string;
  gradedBy?: string;
  gradedAt?: string;
  status: 'pending' | 'submitted' | 'graded';
}

// Online & In-Person Exams
export type ExamType = 'in_person' | 'online';
export type QuestionType = 'multiple_choice' | 'essay';

export interface ExamQuestion {
  id: string;
  examId?: string;
  questionNumber?: number;
  type: QuestionType;
  prompt: string;
  options?: string[]; // 4 options for multiple choice
  correctOptionIndex?: number; // 0..3
  score: number;
}

export interface Exam {
  id: string;
  classroomId: string;
  className: string;
  subject: string;
  title: string;
  type: ExamType;
  date: string;
  startTime: string;
  durationMinutes: number;
  totalScore: number;
  isPublished: boolean;
  teacherId: string;
  teacherName: string;
  description: string;
  questions?: ExamQuestion[];
}

export interface ExamAttempt {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  answers: {
    questionId: string;
    selectedOption?: number;
    essayAnswer?: string;
    isFlaggedForReview?: boolean;
    scoreAwarded?: number;
    feedback?: string;
  }[];
  startedAt: string;
  submittedAt?: string;
  isCompleted: boolean;
  autoScore?: number;
  manualScore?: number;
  finalScore?: number;
}

// Report Cards
export interface SubjectGrade {
  subject: string;
  coefficient: number; // ضریب درس
  inPersonExamScore: number; // نمره آزمون حضوری
  onlineExamScore: number; // نمره آزمون آنلاین
  continuousScore: number; // نمره مستمر
  finalScore: number; // نمره نهایی
  classAverage: number;
  rankInClass: number;
  teacherName: string;
}

export interface ReportCard {
  id: string;
  studentId: string;
  studentName: string;
  classroomId: string;
  className: string;
  term: 'نوبت اول' | 'نوبت دوم' | 'تابستان';
  academicYear: string;
  grades: SubjectGrade[];
  overallGpa: number;
  inPersonGpa: number;
  onlineGpa: number;
  rankInGrade: number;
  rankInClass: number;
  attendanceDaysCount: number;
  absentDaysCount: number;
  lateDaysCount: number;
  isFinalized: boolean;
  finalizedBy?: string;
  finalizedAt?: string;
}

// Counseling
export interface CounselingAppointment {
  id: string;
  studentId: string;
  studentName: string;
  requesterId: string; // student or guardian
  requesterName: string;
  requesterRole: 'student' | 'guardian';
  counselorId: string;
  counselorName: string;
  counselorSpecialty: 'تحصیلی' | 'روانشناختی' | 'انگیزشی';
  type: 'in_person' | 'online';
  topic: string;
  scheduledDate: string; // YYYY/MM/DD
  scheduledTime: string; // HH:mm
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  sharedSummary?: string; // Summary visible to student/guardian
  confidentialNotes?: string; // Strictly confidential for counselor only
  followUpPlan?: string;
}

// Announcements & Notifications
export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: 'official' | 'educational' | 'urgent' | 'pta';
  targetAudience: ('all' | 'teachers' | 'students' | 'guardians' | 'pta')[];
  authorName: string;
  authorRole: string;
  publishedDate: string;
  isPinned: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: 'academic' | 'attendance' | 'exam' | 'system' | 'counseling';
  createdAt: string;
  isRead: boolean;
  isImportant: boolean;
  isArchived: boolean;
  linkUrl?: string;
}

// Parents Council (PTA)
export interface CommitteeMeeting {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  agenda: string[];
  attendeesCount: number;
  minutes?: string; // صورتجلسه
  resolutions?: string[]; // مصوبات
  status: 'upcoming' | 'completed';
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  targetRole: 'guardians' | 'teachers' | 'all';
  scopeType: 'per_guardian' | 'per_family'; // Adjustable anti-duplicate voting policy
  options: {
    id: string;
    text: string;
    votesCount: number;
  }[];
  expiresAt: string;
  userVotedOptionId?: string; // if current user voted
  isActive: boolean;
}

export interface FeedbackItem {
  id: string;
  senderName: string;
  senderRole: string;
  category: 'آموزشی' | 'انضباطی' | 'امکانات' | 'برنامه‌ریزی';
  title: string;
  description: string;
  submittedDate: string;
  status: 'under_review' | 'responded' | 'closed';
  schoolResponse?: string;
  respondedBy?: string;
  respondedAt?: string;
}

// Audit Log
export interface AuditEvent {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: 'attendance' | 'grade' | 'family_link' | 'legal_restriction' | 'permission' | 'exam' | 'online_class';
  entityId: string;
  description: string;
  timestamp: string;
  reason?: string;
  ipAddress?: string;
}

// Parental Consent Forms & School Field Trips
export interface ConsentForm {
  id: string;
  studentId: string;
  studentName: string;
  studentClass?: string;
  guardianUserId?: string;
  title: string;
  description: string;
  activityDate: string;
  deadlineDate: string;
  destination: string;
  transportType?: string;
  insuranceCoverage?: boolean;
  cost?: string;
  capacity?: number;
  status: 'pending' | 'approved' | 'rejected';
  signedByGuardianName?: string;
  signedAt?: string;
  signatureIp?: string;
  emergencyContact?: string;
}

// Online Classes & Virtual Classroom
export type OnlineClassStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';
export type AttendanceOnlineStatus = 'present' | 'late' | 'absent' | 'early_exit';

export interface OnlineClassResource {
  id: string;
  title: string;
  fileName?: string;
  fileSize: string;
  fileType: 'pdf' | 'slide' | 'video' | 'archive' | 'document';
  url?: string;
  fileUrl?: string;
  uploadedAt: string;
}

export interface OnlineClassChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  text: string;
  timestamp: string;
  isTeacher?: boolean;
}

export type OnlineChatMessage = OnlineClassChatMessage;

export interface OnlineClassParticipant {
  userId: string;
  studentId?: string;
  fullName: string;
  role: 'teacher' | 'student' | 'deputy' | 'inspector';
  avatarUrl?: string;
  isMuted: boolean;
  isVideoOn: boolean;
  hasHandRaised: boolean;
  joinedAt?: string;
  connectionQuality: 'excellent' | 'good' | 'poor';
}

export interface OnlineClassAttendance {
  id: string;
  classSessionId: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  joinTime?: string;
  leaveTime?: string;
  durationMinutes: number;
  status: AttendanceOnlineStatus;
  isFinalized: boolean;
  manualCorrectionReason?: string;
  correctedBy?: string;
  correctedAt?: string;
}

export interface OnlineClassSession {
  id: string;
  classroomId: string;
  className: string;
  grade: string;
  subject: string;
  title: string;
  description: string;
  teacherId: string;
  teacherName: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: OnlineClassStatus;
  meetingRoomId: string;
  roomUrl?: string;
  isRecordingEnabled: boolean;
  recordingUrl?: string;
  recordingDurationMinutes?: number;
  recordingAvailableUntil?: string;
  externalPlatform?: 'skyroom' | 'adobe_connect' | 'google_meet' | 'bigbluebutton';
  resources: OnlineClassResource[];
  summaryNote?: string;
  relatedAssignmentId?: string;
  allowedStudentIds?: string[];
}

export interface WeeklyTimetableSlot {
  id: string;
  classroomId: string;
  className: string;
  dayOfWeek: 'saturday' | 'sunday' | 'monday' | 'tuesday' | 'wednesday';
  dayName: string; // شنبه، یکشنبه، دوشنبه، سه‌شنبه، چهارشنبه
  period: 1 | 2 | 3 | 4;
  timeRange: string; // e.g. ۰۸:۰۰ - ۰۹:۳۰
  subject: string;
  teacherId: string;
  teacherName: string;
  roomNumber: string;
  isOnlineAvailable?: boolean;
}
