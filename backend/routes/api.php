<?php

use App\Modules\Academic\Http\Controllers\Api\AcademicApiController;
use App\Modules\Academic\Http\Controllers\Api\TimetableApiController;
use App\Modules\Attendance\Http\Controllers\Api\AttendanceApiController;
use App\Modules\Audit\Http\Controllers\Api\AuditLogsApiController;
use App\Modules\Assignments\Http\Controllers\Api\AssignmentsApiController;
use App\Modules\Exams\Http\Controllers\Api\ExamsApiController;
use App\Modules\Family\Http\Controllers\Api\ConsentsApiController;
use App\Modules\Grades\Http\Controllers\Api\GradesApiController;
use App\Modules\Identity\Http\Controllers\Api\AuthController;
use App\Modules\Identity\Http\Controllers\Api\UsersApiController;
use App\Modules\Identity\Http\Controllers\AuthContextController;
use App\Modules\Imports\Http\Controllers\Api\ImportsApiController;
use App\Modules\Notifications\Http\Controllers\Api\AnnouncementsApiController;
use App\Modules\Notifications\Http\Controllers\Api\NotificationsApiController;
use App\Modules\People\Http\Controllers\Api\CourtOrdersApiController;
use App\Modules\People\Http\Controllers\Api\GuardianLinksApiController;
use App\Modules\People\Http\Controllers\Api\PickupApiController;
use App\Modules\People\Http\Controllers\Api\StudentsApiController;
use App\Modules\School\Http\Controllers\Api\SchoolSettingsApiController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/auth')->group(function (): void {
    Route::post('/otp/request', [AuthController::class, 'requestOtp']);
    Route::post('/otp/verify', [AuthController::class, 'verifyOtp']);

    // Authenticated but role-less: switch-role is the bootstrap of the context.
    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('/switch-role', [AuthController::class, 'switchRole']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});

Route::prefix('v1')->middleware(['auth:sanctum', 'auth.context'])->group(function (): void {
    Route::get('/auth/context', AuthContextController::class)->name('auth.context');

    // Users & roles
    Route::get('/users', [UsersApiController::class, 'index']);
    Route::post('/users', [UsersApiController::class, 'store']);
    Route::patch('/users/{user}', [UsersApiController::class, 'update']);
    Route::post('/users/{user}/phone', [UsersApiController::class, 'updatePhone']);
    Route::post('/users/{user}/roles', [UsersApiController::class, 'assignRole']);
    Route::delete('/users/{user}/roles/{role}', [UsersApiController::class, 'endRole']);

    // Students
    Route::get('/students', [StudentsApiController::class, 'index']);
    Route::post('/students', [StudentsApiController::class, 'store']);
    Route::get('/students/{student}', [StudentsApiController::class, 'show']);
    Route::patch('/students/{student}', [StudentsApiController::class, 'update']);
    Route::post('/students/{student}/national-code', [StudentsApiController::class, 'nationalCode']);

    // Academic structure
    Route::get('/academic/grade-levels', [AcademicApiController::class, 'gradeLevels']);
    Route::post('/academic/grade-levels', [AcademicApiController::class, 'storeGradeLevel']);
    Route::patch('/academic/grade-levels/{gradeLevel}', [AcademicApiController::class, 'updateGradeLevel']);
    Route::post('/academic/subjects', [AcademicApiController::class, 'storeSubject']);
    Route::patch('/academic/subjects/{subject}', [AcademicApiController::class, 'updateSubject']);
    Route::get('/academic/classrooms', [AcademicApiController::class, 'indexClassrooms']);
    Route::post('/academic/classrooms', [AcademicApiController::class, 'storeClassroom']);
    Route::patch('/academic/classrooms/{classroom}', [AcademicApiController::class, 'updateClassroom']);
    Route::post('/academic/classrooms/{classroom}/subjects', [AcademicApiController::class, 'assignSubject']);
    Route::post('/academic/enrollments', [AcademicApiController::class, 'storeEnrollment']);
    Route::post('/academic/enrollments/{enrollment}/end', [AcademicApiController::class, 'endEnrollment']);

    // Guardian links & family
    Route::get('/guardian-links', [GuardianLinksApiController::class, 'index']);
    Route::post('/guardian-links/request', [GuardianLinksApiController::class, 'requestLink']);
    Route::post('/guardian-links/{link}/approve', [GuardianLinksApiController::class, 'approve']);
    Route::patch('/guardian-links/{link}', [GuardianLinksApiController::class, 'update']);
    Route::post('/guardian-links/{link}/end', [GuardianLinksApiController::class, 'end']);
    Route::get('/my/children', [GuardianLinksApiController::class, 'myChildren']);

    // Court orders
    Route::get('/court-orders', [CourtOrdersApiController::class, 'index']);
    Route::post('/court-orders', [CourtOrdersApiController::class, 'store']);
    Route::patch('/court-orders/{order}', [CourtOrdersApiController::class, 'update']);

    // Pickup list
    Route::get('/pickup/{student}', [PickupApiController::class, 'index']);
    Route::post('/pickup/{student}', [PickupApiController::class, 'store']);
    Route::patch('/pickup/authorizations/{authorization}', [PickupApiController::class, 'update']);

    // Audit log
    Route::get('/audit-logs', [AuditLogsApiController::class, 'index']);

    // Timetable
    Route::get('/timetable', [TimetableApiController::class, 'index']);
    Route::post('/timetable', [TimetableApiController::class, 'store']);
    Route::patch('/timetable/{slot}', [TimetableApiController::class, 'update']);
    Route::delete('/timetable/{slot}', [TimetableApiController::class, 'destroy']);

    // Attendance
    Route::post('/attendance/sessions', [AttendanceApiController::class, 'createSession']);
    Route::get('/attendance/sessions', [AttendanceApiController::class, 'indexSessions']);
    Route::get('/attendance/sessions/{session}', [AttendanceApiController::class, 'showSession']);
    Route::post('/attendance/sessions/{session}/records', [AttendanceApiController::class, 'saveRecords']);
    Route::post('/attendance/sessions/{session}/finalize', [AttendanceApiController::class, 'finalize']);
    Route::post('/attendance/records/{record}/correct', [AttendanceApiController::class, 'correct']);
    Route::get('/attendance/students/{student}/records', [AttendanceApiController::class, 'studentRecords']);
    Route::get('/attendance/sms-status', [AttendanceApiController::class, 'smsStatus']);

    // Assignments
    Route::get('/assignments', [AssignmentsApiController::class, 'index']);
    Route::post('/assignments', [AssignmentsApiController::class, 'store']);
    Route::patch('/assignments/{assignment}', [AssignmentsApiController::class, 'update']);
    Route::post('/assignments/{assignment}/submissions', [AssignmentsApiController::class, 'submit']);
    Route::get('/assignments/{assignment}/submissions', [AssignmentsApiController::class, 'submissions']);
    Route::post('/submissions/{submission}/grade', [AssignmentsApiController::class, 'grade']);

    // Grades & report cards
    Route::get('/grades', [GradesApiController::class, 'index']);
    Route::post('/grades', [GradesApiController::class, 'store']);
    Route::patch('/grades/{item}', [GradesApiController::class, 'update']);
    Route::post('/grades/{item}/approve', [GradesApiController::class, 'approve']);
    Route::post('/grades/{item}/change', [GradesApiController::class, 'changePublished']);
    Route::post('/report-cards/publish', [GradesApiController::class, 'publishReportCard']);
    Route::get('/report-cards', [GradesApiController::class, 'reportCards']);
    Route::get('/report-cards/{card}/export', [GradesApiController::class, 'exportPdf']);

    // Online exams
    Route::get('/exams', [ExamsApiController::class, 'index']);
    Route::post('/exams', [ExamsApiController::class, 'store']);
    Route::get('/exams/{exam}', [ExamsApiController::class, 'show']);
    Route::patch('/exams/{exam}', [ExamsApiController::class, 'update']);
    Route::put('/exams/{exam}/questions', [ExamsApiController::class, 'replaceQuestions']);
    Route::post('/exams/{exam}/publish', [ExamsApiController::class, 'publish']);
    Route::post('/exams/{exam}/start', [ExamsApiController::class, 'start']);
    Route::get('/exams/{exam}/result', [ExamsApiController::class, 'result']);
    Route::post('/exams/{exam}/correctors', [ExamsApiController::class, 'assignCorrector']);
    Route::post('/exams/attempts/{attempt}/answers', [ExamsApiController::class, 'saveAnswer']);
    Route::post('/exams/attempts/{attempt}/submit', [ExamsApiController::class, 'submit']);
    Route::post('/exams/answers/{answer}/grade', [ExamsApiController::class, 'gradeAnswer']);

    // Announcements & notification center
    Route::get('/announcements', [AnnouncementsApiController::class, 'index']);
    Route::post('/announcements', [AnnouncementsApiController::class, 'store']);
    Route::patch('/announcements/{announcement}', [AnnouncementsApiController::class, 'update']);
    Route::get('/notifications', [NotificationsApiController::class, 'index']);
    Route::post('/notifications/{notification}/read', [NotificationsApiController::class, 'markRead']);
    Route::post('/notifications/{notification}/archive', [NotificationsApiController::class, 'archive']);
    Route::get('/notification-preferences', [NotificationsApiController::class, 'listPreferences']);
    Route::put('/notification-preferences', [NotificationsApiController::class, 'updatePreference']);
    Route::post('/notification-deliveries/{delivery}/retry', [NotificationsApiController::class, 'retryDelivery']);

    // Consents
    Route::get('/consents', [ConsentsApiController::class, 'index']);
    Route::post('/consents', [ConsentsApiController::class, 'store']);
    Route::patch('/consents/{consent}', [ConsentsApiController::class, 'update']);
    Route::post('/consents/{consent}/respond', [ConsentsApiController::class, 'respond']);

    // Imports & settings
    Route::post('/imports/students', [ImportsApiController::class, 'store']);
    Route::get('/imports/{batch}', [ImportsApiController::class, 'show']);
    Route::get('/school/settings', [SchoolSettingsApiController::class, 'show']);
    Route::put('/school/settings', [SchoolSettingsApiController::class, 'update']);
});
