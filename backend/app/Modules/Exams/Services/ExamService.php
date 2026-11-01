<?php

namespace App\Modules\Exams\Services;

use App\Modules\Exams\Models\AttemptAnswer;
use App\Modules\Exams\Models\AnswerGrade;
use App\Modules\Exams\Models\Exam;
use App\Modules\Exams\Models\ExamAttempt;
use App\Modules\Exams\Models\ExamQuestion;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Online exam engine. Server clock is the only clock (FR-16); answers save
 * idempotently by version (FR-17); one active attempt per student (FR-21).
 */
final class ExamService
{
    /**
     * Start (or resume) the student's single active attempt.
     */
    public function startOrResume(Exam $exam, int $studentId): ExamAttempt
    {
        if ($exam->status !== Exam::STATUS_PUBLISHED) {
            throw ValidationException::withMessages(['exam' => 'این آزمون منتشر نشده است.']);
        }

        $existing = ExamAttempt::query()
            ->where('exam_id', $exam->id)
            ->where('student_id', $studentId)
            ->whereIn('status', [ExamAttempt::STATUS_IN_PROGRESS])
            ->first();

        if ($existing !== null) {
            if ($existing->isExpired()) {
                $existing->forceFill(['status' => ExamAttempt::STATUS_EXPIRED])->save();

                // Fall through and check the window for a fresh attempt only
                // if the exam itself is still open.
            } else {
                return $existing;
            }
        }

        $now = now();

        if ($now->lt($exam->opens_at) || $now->gt($exam->closes_at)) {
            throw ValidationException::withMessages(['exam' => 'آزمون در بازه برگزاری نیست.']);
        }

        $alreadyUsed = ExamAttempt::query()
            ->where('exam_id', $exam->id)
            ->where('student_id', $studentId)
            ->whereIn('status', [ExamAttempt::STATUS_SUBMITTED])
            ->exists();

        if ($alreadyUsed) {
            throw ValidationException::withMessages(['exam' => 'شما قبلاً در این آزمون شرکت کرده‌اید.']);
        }

        return ExamAttempt::query()->create([
            'school_id' => $exam->school_id,
            'exam_id' => $exam->id,
            'student_id' => $studentId,
            'started_at' => $now,
            'server_deadline' => $now->copy()->addMinutes($exam->duration_minutes)->min($exam->closes_at),
            'status' => ExamAttempt::STATUS_IN_PROGRESS,
        ]);
    }

    /**
     * Idempotent autosave: a stale version is ignored, the server state is
     * returned so the client can resync (FR-17/FR-18). A descriptive answer
     * may carry an uploaded sheet (image/PDF).
     */
    public function saveAnswer(ExamAttempt $attempt, int $questionId, ?int $optionId, ?string $text, int $version, bool $flagged = false, ?int $fileId = null): array
    {
        $this->assertWritable($attempt);

        // The option must belong to the answered question (FK integrity with
        // a friendly error instead of a raw 500).
        if ($optionId !== null) {
            $valid = \App\Modules\Exams\Models\ExamOption::query()
                ->where('id', $optionId)
                ->where('question_id', $questionId)
                ->exists();

            if (! $valid) {
                throw ValidationException::withMessages(['option_id' => 'گزینه انتخابی به این سؤال تعلق ندارد.']);
            }
        }

        $answer = AttemptAnswer::query()
            ->where('attempt_id', $attempt->id)
            ->where('question_id', $questionId)
            ->first();

        if ($answer !== null && $version <= $answer->version) {
            // Stale save: the stored version wins, client must catch up.
            return ['accepted' => false, 'version' => $answer->version, 'saved_at' => $answer->saved_at?->toIso8601String()];
        }

        $answer = AttemptAnswer::query()->updateOrCreate(
            ['attempt_id' => $attempt->id, 'question_id' => $questionId],
            [
                'option_id' => $optionId,
                'text' => $text,
                // null keeps the attached sheet, 0 clears it, >0 replaces it.
                'file_id' => $fileId === 0 ? null : ($fileId ?? ($answer->file_id ?? null)),
                'version' => $version,
                'flagged' => $flagged,
                'saved_at' => now(),
            ],
        );

        return ['accepted' => true, 'version' => $answer->version, 'saved_at' => $answer->saved_at->toIso8601String()];
    }

    public function flagQuestion(ExamAttempt $attempt, int $questionId, bool $flagged): void
    {
        $this->assertWritable($attempt);

        AttemptAnswer::query()->updateOrCreate(
            ['attempt_id' => $attempt->id, 'question_id' => $questionId],
            ['flagged' => $flagged, 'version' => 1, 'saved_at' => now()],
        );
    }

    /**
     * FR-19: explicit submit — scores the MCQ part automatically (FR-20).
     */
    public function submit(ExamAttempt $attempt): ExamAttempt
    {
        $this->assertWritable($attempt);

        return DB::transaction(function () use ($attempt) {
            $autoScore = $this->scoreMcq($attempt);

            $attempt->forceFill([
                'status' => ExamAttempt::STATUS_SUBMITTED,
                'submitted_at' => now(),
                'auto_score' => $autoScore,
            ])->save();

            return $attempt->fresh();
        });
    }

    /**
     * Lazy sweep: in_progress attempts past the server deadline expire.
     */
    public function expireOverdue(): int
    {
        return ExamAttempt::query()
            ->where('status', ExamAttempt::STATUS_IN_PROGRESS)
            ->where(fn ($q) => $q->where('server_deadline', '<', now()))
            ->update(['status' => ExamAttempt::STATUS_EXPIRED]);
    }

    private function scoreMcq(ExamAttempt $attempt): int
    {
        $questions = ExamQuestion::query()
            ->where('exam_id', $attempt->exam_id)
            ->where('type', ExamQuestion::TYPE_MCQ)
            ->with('options')
            ->get()
            ->keyBy('id');

        $answers = AttemptAnswer::query()
            ->where('attempt_id', $attempt->id)
            ->get()
            ->keyBy('question_id');

        $score = 0;

        foreach ($questions as $question) {
            $answer = $answers->get($question->id);

            if ($answer !== null
                && $answer->option_id !== null
                && (int) $answer->option_id === (int) $question->correct_option_id) {
                $score += $question->points;
            }
        }

        return $score;
    }

    /**
     * sh5: descriptive answers are graded by the subject teacher or an
     * explicitly assigned corrector.
     */
    public function gradeDescriptive(AttemptAnswer $answer, int $score, ?string $comment, int $graderId): AnswerGrade
    {
        $question = $answer->question;
        $attempt = $answer->attempt;

        if ($attempt->status === ExamAttempt::STATUS_IN_PROGRESS) {
            throw ValidationException::withMessages(['attempt' => 'آزمون هنوز تمام نشده است.']);
        }

        if ($score > $question->points) {
            throw ValidationException::withMessages(['score' => 'نمره بیشتر از بارم سؤال است.']);
        }

        return AnswerGrade::query()->updateOrCreate(
            ['answer_id' => $answer->id],
            ['score' => $score, 'comment' => $comment, 'graded_by' => $graderId, 'graded_at' => now()],
        );
    }

    /**
     * sh6: may the student see scores right now?
     */
    public function resultsVisibleFor(Exam $exam): bool
    {
        $this->expireOverdue();

        return $exam->resultsVisible();
    }

    private function assertWritable(ExamAttempt $attempt): void
    {
        if ($attempt->status !== ExamAttempt::STATUS_IN_PROGRESS) {
            throw ValidationException::withMessages(['attempt' => 'این نشست دیگر فعال نیست.']);
        }

        if ($attempt->isExpired()) {
            $attempt->forceFill(['status' => ExamAttempt::STATUS_EXPIRED])->save();
            throw ValidationException::withMessages(['attempt' => 'زمان آزمون به پایان رسیده است.']);
        }
    }
}
