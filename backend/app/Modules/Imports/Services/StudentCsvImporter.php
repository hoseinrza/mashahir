<?php

namespace App\Modules\Imports\Services;

use App\Modules\Audit\Services\AuditService;
use App\Modules\Imports\Models\ImportBatch;
use App\Modules\People\Models\Student;
use App\Modules\People\Services\StudentAccountService;
use App\Modules\Identity\Models\User;
use App\Modules\Imports\Services\SpreadsheetReader;
use App\Support\PhoneHash;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Roster importer. Accepts CSV or Excel (xlsx) — SpreadsheetReader hands the
 * rows. Columns (header row required): student_code, first_name, last_name,
 * national_code (optional), phone (optional — mints/links the login account).
 * Every rejected row is reported with its line number (FR-34).
 */
final class StudentCsvImporter
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly StudentAccountService $accounts,
    ) {
    }

    public function import(string $path, User $actor): ImportBatch
    {
        /** @var SchoolContext $context */
        $context = app(\App\Support\SchoolContext::class);
        $schoolId = (int) $context->schoolId();

        $batch = ImportBatch::query()->create([
            'school_id' => $schoolId,
            'kind' => 'students',
            'status' => 'processing',
            'created_by' => $actor->id,
        ]);

        $rows = SpreadsheetReader::rows($path);

        $header = null;
        $rowNumber = 0;
        $ok = 0;

        try {
            DB::transaction(function () use ($rows, $batch, $schoolId, &$header, &$rowNumber, &$ok) {
                foreach ($rows as $raw) {
                    $rowNumber++;

                    if ($rowNumber === 1) {
                        $header = array_map(fn ($h) => strtolower(trim((string) $h)), $raw ?? []);
                        continue;
                    }

                    if (count(array_filter($raw ?? [], fn ($v) => trim((string) $v) !== '')) === 0) {
                        continue; // skip blank lines
                    }

                    // Align to the header width both ways — Excel rows carry
                    // trailing empty columns, CSV rows may run past the header.
                    $values = array_slice(
                        array_pad(array_map(fn ($v) => $v === null ? null : trim((string) $v), $raw), count($header), null),
                        0,
                        count($header),
                    );
                    $row = array_combine($header, $values);

                    $error = $this->validateRow($row, $schoolId);
                    if ($error !== null) {
                        $batch->errors()->create(['row_number' => $rowNumber, 'message' => $error]);
                        continue;
                    }

                    $student = Student::query()->create([
                        'school_id' => $schoolId,
                        'student_code' => $row['student_code'],
                        'first_name' => $row['first_name'],
                        'last_name' => $row['last_name'],
                        'national_code' => $row['national_code'] ?? null,
                        'status' => 'active',
                    ]);

                    try {
                        // Mints/links the login account when a phone is given.
                        $this->accounts->linkPhone($student, $row['phone'] ?? null);
                    } catch (ValidationException $e) {
                        // Same-transaction rollback of the just-created row
                        // plus a per-line error report (FR-34).
                        $student->delete();
                        $batch->errors()->create(['row_number' => $rowNumber, 'message' => $e->getMessage()]);
                        continue;
                    }

                    $ok++;
                }

                $batch->forceFill([
                    'status' => 'done',
                    'rows_total' => $rowNumber - 1,
                    'rows_ok' => $ok,
                ])->save();
            });
        } catch (\Throwable $e) {
            $batch->forceFill(['status' => 'failed'])->save();
            throw $e;
        }

        $this->audit->log('import.students_done', $batch, new: [
            'rows_total' => $batch->rows_total, 'rows_ok' => $batch->rows_ok,
        ]);

        return $batch->fresh();
    }

    private function validateRow(?array $row, int $schoolId): ?string
    {
        if ($row === null || empty($row['student_code']) || empty($row['first_name']) || empty($row['last_name'])) {
            return 'ستون‌های student_code و first_name و last_name الزامی‌اند.';
        }

        if (! empty($row['national_code']) && ! preg_match('/^\d{10}$/', $row['national_code'])) {
            return 'کد ملی باید ۱۰ رقم باشد.';
        }

        $phone = $this->accounts->normalizePhone($row['phone'] ?? null);
        if ($phone !== null) {
            if (! preg_match('/^09\d{9}$/', $phone)) {
                return 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.';
            }

            $user = User::query()->where('phone_hash', PhoneHash::of($phone))->first();
            if ($user !== null && Student::query()->where('user_id', $user->id)->exists()) {
                return 'این شماره قبلاً به دانش‌آموز دیگری متصل شده است.';
            }
        }

        if (Student::query()->where('school_id', $schoolId)->where('student_code', $row['student_code'])->exists()) {
            return "کد دانش‌آموزی {$row['student_code']} تکراری است.";
        }

        return null;
    }
}
