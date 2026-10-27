<?php

use App\Modules\Academic\Http\Controllers\Api\AcademicApiController;
use App\Modules\Audit\Http\Controllers\Api\AuditLogsApiController;
use App\Modules\Identity\Http\Controllers\Api\AuthController;
use App\Modules\Identity\Http\Controllers\Api\UsersApiController;
use App\Modules\Identity\Http\Controllers\AuthContextController;
use App\Modules\People\Http\Controllers\Api\CourtOrdersApiController;
use App\Modules\People\Http\Controllers\Api\GuardianLinksApiController;
use App\Modules\People\Http\Controllers\Api\PickupApiController;
use App\Modules\People\Http\Controllers\Api\StudentsApiController;
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
    Route::post('/academic/subjects', [AcademicApiController::class, 'storeSubject']);
    Route::get('/academic/classrooms', [AcademicApiController::class, 'indexClassrooms']);
    Route::post('/academic/classrooms', [AcademicApiController::class, 'storeClassroom']);
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

    // Pickup list
    Route::get('/pickup/{student}', [PickupApiController::class, 'index']);
    Route::post('/pickup/{student}', [PickupApiController::class, 'store']);
    Route::patch('/pickup/authorizations/{authorization}', [PickupApiController::class, 'update']);

    // Audit log
    Route::get('/audit-logs', [AuditLogsApiController::class, 'index']);
});
