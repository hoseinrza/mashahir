<?php

namespace Tests\Feature\Modules;

use App\Modules\Files\Models\File;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

/**
 * The file manager (فایل منیجر): homework sheets and descriptive exam
 * answers arrive as image/PDF only, validated from real bytes, and every
 * download is access-checked against the referencing object.
 */
class FilesUploadTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    private $teacher;

    private $classroom;

    private $subjectId;

    private $student;

    private $studentUser;

    private $guardian;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();

        $this->teacher = $this->makeUser();
        $this->classroom = $this->makeClassroom();
        $this->subjectId = $this->assignTeacher($this->teacher, $this->classroom, $this->makeSubject())->id;

        $this->student = $this->makeStudent();
        $this->studentUser = $this->makeUser();
        $this->student->forceFill(['user_id' => $this->studentUser->id])->save();
        $this->enroll($this->student, $this->classroom);

        $this->guardian = $this->makeUser();
        \App\Modules\People\Models\GuardianLink::query()->create([
            'guardian_user_id' => $this->guardian->id,
            'student_id' => $this->student->id,
            'link_type' => 'primary', 'status' => 'active', 'approved_at' => now(),
        ]);
    }

    // ── Validation ───────────────────────────────────────────────────────

    public function test_upload_accepts_pdf_and_image_from_real_bytes(): void
    {
        $this->actingWithRole('student', user: $this->studentUser);

        $pdf = $this->post('/api/v1/files', [
            'file' => UploadedFile::fake()->createWithContent('پاسخ_تکلیف.pdf', self::PDF_BYTES),
        ])->assertCreated()->json();

        $this->assertSame('application/pdf', $pdf['mime']);
        $this->assertSame('پاسخ_تکلیف.pdf', $pdf['original_name']);

        $png = $this->post('/api/v1/files', [
            'file' => UploadedFile::fake()->createWithContent('answer.png', self::PNG_BYTES),
        ])->assertCreated()->json();

        $this->assertSame('image/png', $png['mime']);

        $row = File::query()->where('ulid', $pdf['ulid'])->firstOrFail();
        $this->assertSame(hash('sha256', self::PDF_BYTES), $row->checksum);
        $this->assertDatabaseHas('files', ['ulid' => $png['ulid'], 'mime' => 'image/png']);
    }

    public function test_upload_rejects_non_image_pdf_content_even_with_pdf_extension(): void
    {
        $this->actingWithRole('student', user: $this->studentUser);

        // Plain text pretending to be a PDF: the extension lies, the bytes do not.
        $this->post('/api/v1/files', [
            'file' => UploadedFile::fake()->createWithContent('fake.pdf', 'hello world'),
        ])->assertJsonValidationErrors(['file']);

        $this->post('/api/v1/files', [
            'file' => UploadedFile::fake()->createWithContent('notes.txt', 'hello world'),
        ])->assertJsonValidationErrors(['file']);

        $this->assertSame(0, File::query()->count());
    }

    public function test_upload_requires_an_attachment_capable_permission(): void
    {
        // Corrector holds exams.grade_descriptive only — no upload path.
        $corrector = $this->makeUser();
        $this->actingWithRole('corrector', user: $corrector);

        $this->post('/api/v1/files', [
            'file' => UploadedFile::fake()->createWithContent('x.pdf', self::PDF_BYTES),
        ])->assertNotFound();

        $this->assertSame(0, File::query()->count());
    }

    // ── Download access ──────────────────────────────────────────────────

    public function test_submission_file_is_visible_to_teacher_guardian_owner_only(): void
    {
        $fileUlid = $this->submitHomeworkWithFile();

        // Class teacher → 200 with the exact bytes.
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacher);

        $this->getJson("/api/v1/files/{$fileUlid}")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf');

        // Foreign teacher (no classroom subjects) → 404.
        $foreignTeacher = $this->makeUser();
        $this->actingWithRole('teacher', user: $foreignTeacher);
        $this->getJson("/api/v1/files/{$fileUlid}")->assertNotFound();

        // Guardian of the child → 200.
        $this->actingWithRole('guardian', user: $this->guardian);
        $this->getJson("/api/v1/files/{$fileUlid}")->assertOk();

        // A different student → 404 (sh4: other pupils' work is invisible).
        $otherStudentUser = $this->makeUser();
        $other = $this->makeStudent();
        $other->forceFill(['user_id' => $otherStudentUser->id])->save();
        $this->actingWithRole('student', user: $otherStudentUser);
        $this->getJson("/api/v1/files/{$fileUlid}")->assertNotFound();

        // The owning student re-downloads his own sheet → 200.
        $this->actingWithRole('student', user: $this->studentUser);
        $this->getJson("/api/v1/files/{$fileUlid}")->assertOk();
    }

    // ── Assignment flow with sheets ──────────────────────────────────────

    public function test_student_submits_assignment_as_file_and_teacher_grades(): void
    {
        $fileUlid = $this->submitHomeworkWithFile();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacher);

        $assignmentUlid = \App\Modules\Assignments\Models\Assignment::query()->value('ulid');
        $rows = $this->getJson("/api/v1/assignments/{$assignmentUlid}/submissions")->assertOk()->json('data');
        $this->assertCount(1, $rows);
        $this->assertSame($fileUlid, $rows[0]['files'][0]['ulid']);
        $this->assertNull($rows[0]['text']);

        $submissionId = $rows[0]['id'];
        $this->postJson("/api/v1/submissions/{$submissionId}/grade", [
            'score' => 18, 'feedback' => 'برگه تمیز و کامل بود',
        ])->assertOk()->assertJsonPath('status', 'graded');
    }

    public function test_submission_requires_text_or_file(): void
    {
        $assignmentUlid = $this->createAssignment();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('student', user: $this->studentUser);

        $this->postJson("/api/v1/assignments/{$assignmentUlid}/submissions", [])
            ->assertJsonValidationErrors(['text']);
    }

    public function test_assignment_sheet_files_reach_enrolled_students(): void
    {
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacher);

        $sheet = $this->post('/api/v1/files', [
            'file' => UploadedFile::fake()->createWithContent('صورت_تمرین.pdf', self::PDF_BYTES),
        ])->assertCreated()->json();

        $assignmentUlid = $this->createAssignment($sheet['ulid']);

        // Teacher payload carries the sheet.
        $created = collect($this->getJson('/api/v1/assignments')->assertOk()->json('data'))
            ->first(fn ($a) => $a['ulid'] === $assignmentUlid);
        $this->assertSame($sheet['ulid'], $created['files'][0]['ulid']);

        // Enrolled student sees and downloads the sheet.
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('student', user: $this->studentUser);

        $seen = collect($this->getJson('/api/v1/assignments')->assertOk()->json('data'))
            ->first(fn ($a) => $a['ulid'] === $assignmentUlid);
        $this->assertSame($sheet['ulid'], $seen['files'][0]['ulid']);

        $this->getJson("/api/v1/files/{$sheet['ulid']}")->assertOk();
    }

    // ── Descriptive exam answer as image/PDF ─────────────────────────────

    public function test_descriptive_answer_file_reaches_the_grader(): void
    {
        $this->actingWithRole('teacher', user: $this->teacher);
        $exam = $this->postJson('/api/v1/exams', $this->examPayload($this->subjectId))->assertCreated()->json();
        $this->postJson("/api/v1/exams/{$exam['ulid']}/publish")->assertOk();

        $questions = $this->getJson("/api/v1/exams/{$exam['ulid']}")->json('questions');
        $mcqId = collect($questions)->firstWhere('type', 'mcq')['id'];
        $descriptiveId = collect($questions)->firstWhere('type', 'descriptive')['id'];

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('student', user: $this->studentUser);

        $attempt = $this->postJson("/api/v1/exams/{$exam['ulid']}/start")->assertOk()->json();

        $upload = $this->post('/api/v1/files', [
            'file' => UploadedFile::fake()->createWithContent('پاسخ_تشریحی.pdf', self::PDF_BYTES),
        ])->assertCreated()->json();

        // A file cannot ride on an MCQ question.
        $this->postJson("/api/v1/exams/attempts/{$attempt['attempt_id']}/answers", [
            'question_id' => $mcqId, 'file_ulid' => $upload['ulid'], 'version' => 1,
        ])->assertJsonValidationErrors(['file_ulid']);

        // The descriptive answer carries the sheet.
        $this->postJson("/api/v1/exams/attempts/{$attempt['attempt_id']}/answers", [
            'question_id' => $descriptiveId, 'file_ulid' => $upload['ulid'], 'version' => 1,
        ])->assertOk()->assertJsonPath('accepted', true);

        // Text-only autosave afterwards keeps the attachment.
        $this->postJson("/api/v1/exams/attempts/{$attempt['attempt_id']}/answers", [
            'question_id' => $descriptiveId, 'text' => 'توضیح تکمیلی', 'version' => 2,
        ])->assertOk()->assertJsonPath('accepted', true);

        $this->postJson("/api/v1/exams/attempts/{$attempt['attempt_id']}/submit")->assertOk();

        // Teacher sees the file next to the answer and grades it.
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacher);

        $result = $this->getJson("/api/v1/exams/{$exam['ulid']}/result")->assertOk()->json('data.0');
        $answer = collect($result['answers'])->first(fn ($a) => $a['type'] === 'descriptive');
        $this->assertSame($upload['ulid'], $answer['file']['ulid']);

        $answerId = $answer['answer_id'];
        $this->postJson("/api/v1/exams/answers/{$answerId}/grade", [
            'score' => 3, 'comment' => 'اثبات درست بود',
        ])->assertOk();

        // The owning student can always re-download his own sheet (sh4).
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('student', user: $this->studentUser);
        $this->getJson("/api/v1/files/{$upload['ulid']}")->assertOk();
    }

    // ── Fixtures ─────────────────────────────────────────────────────────

    private const PDF_BYTES = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF";

    private const PNG_BYTES = "\x89PNG\r\n\x1a\n\0\0\0\rIHDR\0\0\0\x01\0\0\0\x01\x08\x06\0\0\0\x1f\x15\xc4\x89\0\0\0\nIDATx\x9cc\0\x01\0\0\x05\0\x01\r\n-\xb4\0\0\0\0IEND\xaeB`\x82";

    private function createAssignment(?string $sheetUlid = null): string
    {
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacher);

        $payload = [
            'classroom_subject_id' => $this->subjectId,
            'title' => 'تم ریاضی فصل ۱',
            'description' => 'تمرین‌های ۱ تا ۵',
            'due_at' => now()->addDays(2)->toIso8601String(),
        ];

        if ($sheetUlid !== null) {
            $payload['file_ulids'] = [$sheetUlid];
        }

        return $this->postJson('/api/v1/assignments', $payload)->assertCreated()->json('ulid');
    }

    /** Student uploads a PDF and submits it as the whole homework. */
    private function submitHomeworkWithFile(): string
    {
        $assignmentUlid = $this->createAssignment();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('student', user: $this->studentUser);

        $upload = $this->post('/api/v1/files', [
            'file' => UploadedFile::fake()->createWithContent('پاسخ_پارسا.pdf', self::PDF_BYTES),
        ])->assertCreated()->json();

        $this->postJson("/api/v1/assignments/{$assignmentUlid}/submissions", [
            'file_ulids' => [$upload['ulid']],
        ])->assertCreated()->assertJsonPath('files.0.ulid', $upload['ulid']);

        return $upload['ulid'];
    }

    private function examPayload(int $subjectId): array
    {
        return [
            'classroom_subject_id' => $subjectId,
            'title' => 'آزمون تشریحی فیزیک',
            'opens_at' => now()->subMinutes(5)->toIso8601String(),
            'closes_at' => now()->addHours(2)->toIso8601String(),
            'duration_minutes' => 45,
            'result_visibility' => 'after_grading',
            'questions' => [
                ['type' => 'mcq', 'body' => 'یکای نیرو؟', 'points' => 1,
                 'options' => ['نیوتن', 'ژول'], 'correct_position' => 1],
                ['type' => 'descriptive', 'body' => 'قانون دوم نیوتن را توضیح دهید.', 'points' => 3],
            ],
        ];
    }
}
