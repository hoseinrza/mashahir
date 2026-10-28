<?php

namespace App\Modules\Grades\Services;

use App\Modules\Academic\Models\AcademicYear;
use App\Modules\Audit\Services\AuditService;
use App\Modules\Grades\Models\GradeChange;
use App\Modules\Grades\Models\GradeItem;
use App\Modules\Grades\Models\ReportCard;
use App\Modules\Grades\Models\ReportCardLine;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Grade workflow: teacher drafts (sh2) -> deputy approves -> admin/deputy
 * publishes. Publishing freezes a report-card version; later changes go
 * through grade_changes with a mandatory reason (sh7).
 */
final class GradeService
{
    public function __construct(private readonly AuditService $audit)
    {
    }

    public function recordDraft(
        int $studentId,
        int $classroomSubjectId,
        int $termId,
        int $score,
        int $maxScore,
        string $sourceType,
        ?int $sourceId,
        string $delivery,
        int $recorderId,
    ): GradeItem {
        return GradeItem::query()->create([
            'student_id' => $studentId,
            'classroom_subject_id' => $classroomSubjectId,
            'term_id' => $termId,
            'source_type' => $sourceType,
            'source_id' => $sourceId,
            'delivery' => $delivery,
            'status' => GradeItem::STATUS_DRAFT,
            'score' => $score,
            'max_score' => $maxScore,
            'recorded_by' => $recorderId,
        ]);
    }

    public function approve(GradeItem $item, int $approverId): GradeItem
    {
        if ($item->status !== GradeItem::STATUS_DRAFT) {
            throw ValidationException::withMessages(['status' => 'فقط نمره پیش‌نویس قابل تأیید است.']);
        }

        $item->forceFill([
            'status' => GradeItem::STATUS_APPROVED,
            'approved_by' => $approverId,
        ])->save();

        return $item->fresh();
    }

    /**
     * Publish one student's approved grades of a term+kind as a new frozen
     * report-card version (previous published version becomes superseded).
     */
    public function publishReportCard(int $studentId, int $termId, string $kind, int $publisherId): ReportCard
    {
        if (! in_array($kind, [ReportCard::KIND_IN_PERSON, ReportCard::KIND_ONLINE], true)) {
            throw ValidationException::withMessages(['kind' => 'نوع کارنامه نامعتبر است.']);
        }

        return DB::transaction(function () use ($studentId, $termId, $kind, $publisherId) {
            $schoolId = (int) app(\App\Support\SchoolContext::class)->schoolId();

            $items = GradeItem::query()
                ->where('student_id', $studentId)
                ->where('term_id', $termId)
                ->where('delivery', $kind === ReportCard::KIND_ONLINE ? 'online' : 'in_person')
                ->where('status', GradeItem::STATUS_APPROVED)
                ->with('classroomSubject.subject')
                ->get();

            if ($items->isEmpty()) {
                throw ValidationException::withMessages(['items' => 'نمره تأییدشده‌ای برای انتشار نیست.']);
            }

            ReportCard::query()
                ->where('student_id', $studentId)
                ->where('term_id', $termId)
                ->where('kind', $kind)
                ->where('status', ReportCard::STATUS_PUBLISHED)
                ->update(['status' => ReportCard::STATUS_SUPERSEDED]);

            $version = (int) ReportCard::query()
                ->where('student_id', $studentId)
                ->where('term_id', $termId)
                ->where('kind', $kind)
                ->max('version') + 1;

            $card = ReportCard::query()->create([
                'student_id' => $studentId,
                'term_id' => $termId,
                'kind' => $kind,
                'version' => $version,
                'status' => ReportCard::STATUS_PUBLISHED,
                'published_by' => $publisherId,
                'published_at' => now(),
            ]);

            foreach ($items as $item) {
                ReportCardLine::query()->create([
                    'report_card_id' => $card->id,
                    'subject_id' => $item->classroomSubject->subject_id,
                    'score' => $item->score,
                ]);

                $item->forceFill(['status' => GradeItem::STATUS_PUBLISHED, 'published_at' => now()])->save();
            }

            $this->audit->log('report_card.published', $card, new: [
                'version' => $version, 'kind' => $kind, 'lines' => $items->count(),
            ]);

            return $card->fresh(['lines.subject']);
        });
    }

    /**
     * sh7: changing a PUBLISHED grade requires a reason and lands in the
     * append-only grade_changes table.
     */
    public function changePublished(GradeItem $item, int $newScore, string $reason, int $changerId): GradeChange
    {
        if ($item->status !== GradeItem::STATUS_PUBLISHED) {
            throw ValidationException::withMessages(['status' => 'این مسیر فقط برای نمره منتشرشده است.']);
        }

        if ($newScore > $item->max_score) {
            throw ValidationException::withMessages(['score' => 'نمره بیشتر از سقف است.']);
        }

        $oldScore = $item->score;

        return DB::transaction(function () use ($item, $newScore, $reason, $changerId, $oldScore) {
            $change = GradeChange::query()->create([
                'grade_item_id' => $item->id,
                'old_score' => $oldScore,
                'new_score' => $newScore,
                'reason' => $reason,
                'changed_by' => $changerId,
            ]);

            $item->forceFill(['score' => $newScore])->save();

            // Published report-card lines stay FROZEN; a re-publish creates a
            // new version — that is the documented behavior.

            $this->audit->log('grade.changed_published', $item, old: ['score' => $oldScore], new: ['score' => $newScore], reason: $reason);

            return $change;
        });
    }
}
