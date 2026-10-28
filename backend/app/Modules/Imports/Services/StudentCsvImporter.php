<?php

namespace App\Modules\Imports\Services;

use App\Modules\Audit\Services\AuditService;
use App\Modules\Imports\Models\ImportBatch;
use App\Modules\People\Models\Student;
use App\Modules\Identity\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * CSV importer for students. Columns (header row required):
 * student_code, first_name, last_name, national_code (optional).
 * Every rejected row is reported with its line number (FR-34).
 */
final class StudentCsvImporter
{
    public function __construct(private readonly AuditService $audit)
    {
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

        $handle = fopen($path, 'r');
        if ($handle === false) {
            $batch->forceFill(['status' => 'failed'])->save();

            return $batch;
        }

        $header = null;
        $rowNumber = 0;
        $ok = 0;

        try {
            DB::transaction(function () use ($handle, $batch, $schoolId, $actor, &$header, &$rowNumber, &$ok) {
                while (($raw = fgetcsv($handle, 0, ',')) !== false) {
                    $rowNumber++;

                    if ($rowNumber === 1) {
                        $header = array_map(fn ($h) => strtolower(trim((string) $h)), $raw);
                        continue;
                    }

                    if (count(array_filter($raw, fn ($v) => trim((string) $v) !== '')) === 0) {
                        continue; // skip blank lines
                    }

                    $row = array_combine($header, array_pad(array_map('trim', $raw), count($header), null));

                    $error = $this->validateRow($row, $schoolId);
                    if ($error !== null) {
                        $batch->errors()->create(['row_number' => $rowNumber, 'message' => $error]);
                        continue;
                    }

                    Student::query()->create([
                        'school_id' => $schoolId,
                        'student_code' => $row['student_code'],
                        'first_name' => $row['first_name'],
                        'last_name' => $row['last_name'],
                        'national_code' => $row['national_code'] ?? null,
                        'status' => 'active',
                    ]);

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
        } finally {
            fclose($handle);
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

        if (Student::query()->where('school_id', $schoolId)->where('student_code', $row['student_code'])->exists()) {
            return "کد دانش‌آموزی {$row['student_code']} تکراری است.";
        }

        return null;
    }
}
