<?php

namespace App\Modules\Grades\Services;

use App\Modules\Academic\Models\Enrollment;
use App\Modules\Grades\Models\GradeItem;
use App\Modules\Grades\Models\ReportCard;
use App\Modules\Grades\Models\ReportCardLine;
use App\Modules\Identity\Models\User;
use App\Modules\People\Models\Student;
use App\Modules\People\Services\GuardianAccessService;
use App\Modules\School\Models\School;
use App\Support\Jalali;
use App\Support\Rbac\PermissionRegistrar;
use App\Support\Rbac\ScopeResolver;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * One place decides which report cards a caller may see, and one place turns a
 * card into printable rows. The JSON list and the printed sheet both come from
 * here, so a document can never be wider than the screen that produced it.
 */
class ReportCardSheetService
{
    /** Printed sheets and the web view must describe the same score the same way. */
    public const BANDS = [
        ['key' => 'excellent', 'min' => 17.0, 'label' => 'خیلی خوب'],
        ['key' => 'good', 'min' => 14.0, 'label' => 'خوب'],
        ['key' => 'acceptable', 'min' => 10.0, 'label' => 'قابل قبول'],
        ['key' => 'needs_work', 'min' => -1.0, 'label' => 'نیاز به تلاش'],
    ];

    public const KIND_LABELS = [
        ReportCard::KIND_IN_PERSON => 'کارنامه آزمون‌های حضوری',
        ReportCard::KIND_ONLINE => 'کارنامه سنجش آنلاین و مستمر',
    ];

    public const STATUS_LABELS = [
        ReportCard::STATUS_PUBLISHED => 'منتشرشده و نهایی',
        ReportCard::STATUS_APPROVED => 'تأییدشده — منتشر نشده',
        ReportCard::STATUS_DRAFT => 'پیش‌نویس',
        ReportCard::STATUS_SUPERSEDED => 'جایگزین‌شده',
    ];

    public const SOURCE_LABELS = [
        'exam' => 'آزمون',
        'in_person_exam' => 'آزمون حضوری',
        'assignment' => 'تکلیف و فعالیت کلاسی',
        'manual' => 'ثبت دستی دبیر',
    ];

    /** Sheets in one document: enough for a class, small enough to render at once. */
    public const MAX_SHEETS = 60;

    public function __construct(
        private readonly ScopeResolver $resolver,
        private readonly GuardianAccessService $access,
    ) {
    }

    /**
     * @param  array{student_ulids?: array<int,string>, kind?: string|null, limit?: int}  $filters
     * @return Collection<int, ReportCard>
     */
    public function visibleCards(Request $request, array $filters = []): Collection
    {
        $limit = min(max($filters['limit'] ?? 100, 1), self::MAX_SHEETS);
        $ulids = array_values(array_filter((array) ($filters['student_ulids'] ?? [])));

        $query = $this->visibleQuery($request, $filters['kind'] ?? null, (bool) ($filters['published_only'] ?? false));

        if ($ulids !== []) {
            $ids = Student::query()->whereIn('ulid', $ulids)->pluck('id')->all();

            // A ulid outside the caller's scope resolves to nothing rather than
            // to somebody else's file; the print route then reports the empty set.
            $query->whereIn('student_id', $ids ?: [0]);
        }

        return $query->limit($limit)->get();
    }

    /** Role scoping (sh3/sh4 + FR-25): the same builder feeds the API and the printer. */
    public function visibleQuery(Request $request, ?string $kind = null, bool $publishedOnly = false): Builder
    {
        $roleKey = app(PermissionRegistrar::class)->activeRole()?->role->key;

        $query = ReportCard::query()
            ->with(['student', 'term', 'lines.subject'])
            ->orderByDesc('id');

        if ($kind !== null && $kind !== '') {
            $query->where('kind', $kind);
        }

        if (in_array($roleKey, ['guardian', 'student'], true)) {
            $ids = $this->resolver->studentIds() ?? [];

            if ($roleKey === 'guardian') {
                $ids = collect($ids)->filter(
                    fn ($sid) => $this->access->may($request->user()->id, $sid, 'can_view_grades'),
                )->all();
            }

            $query->whereIn('student_id', $ids ?: [0])->where('status', ReportCard::STATUS_PUBLISHED);
        } elseif (! $publishedOnly && ! app(PermissionRegistrar::class)->allows('reportcards.view_draft')) {
            $query->where('status', ReportCard::STATUS_PUBLISHED);
        } elseif ($publishedOnly) {
            // Paper is always the issued version: staff may read drafts on
            // screen, but an official sheet only exists once it is published.
            $query->where('status', ReportCard::STATUS_PUBLISHED);
        }

        return $query;
    }

    /**
     * Printable payload: document header, then one sheet per card.
     *
     * @param  Collection<int, ReportCard>  $cards
     * @return array{school: array{name: string, level_label: string}, document: array{title: string, generated_at: string, sheets: int}, sheets: array<int, array<string, mixed>>}
     */
    public function document(Request $request, Collection $cards): array
    {
        $ceilings = $this->ceilingMap($cards);
        $classrooms = $this->classroomTitles($cards);
        $issuers = $this->issuerNames($cards);
        $ranks = $this->rankMap($cards);

        return [
            'school' => $this->schoolHeader($cards),
            'document' => [
                'title' => 'برگه کارنامه رسمی',
                'generated_at' => Jalali::dateTime(now()),
                'sheets' => $cards->count(),
                'actor' => optional($request->user())->fullName() ?? '—',
            ],
            'sheets' => $cards
                // A bundle prints one page per learner: keep a learner's sheets
                // together and ordered like the roster the principal selected from.
                ->sortBy(fn (ReportCard $c) => [
                    $c->student?->last_name ?? '',
                    $c->student?->first_name ?? '',
                    $c->kind,
                    -((int) $c->version),
                ])
                ->values()
                ->map(fn (ReportCard $c) => [
                'ulid' => $c->ulid,
                'student_name' => $c->student?->fullName() ?? '—',
                'student_code' => $c->student?->student_code ?? '—',
                'classroom' => $classrooms[$c->student_id] ?? '—',
                'term' => $c->term?->title ?? '—',
                'kind' => $c->kind,
                'kind_label' => self::KIND_LABELS[$c->kind] ?? 'کارنامه تحصیلی',
                'version' => $c->version,
                'status' => $c->status,
                'status_label' => self::STATUS_LABELS[$c->status] ?? $c->status,
                'published_at' => Jalali::dateTime($c->published_at),
                'issued_by' => $issuers[$c->published_by] ?? '—',
                'lines' => $c->lines->map(fn (ReportCardLine $l) => $this->printableLine($c, $l, $ceilings))->values()->all(),
                'avg' => $this->average($c, $ceilings),
                'rank' => $ranks[$c->ulid]['rank'] ?? null,
                'rank_of' => $ranks[$c->ulid]['of'] ?? null,
                'band_counts' => $this->bandCounts($c, $ceilings),
            ])->all(),
        ];
    }

    /** @return array{name: string, level_label: string} */
    private function schoolHeader(Collection $cards): array
    {
        $school = $cards->isNotEmpty()
            ? School::query()->find($cards->first()->school_id)
            : null;

        return [
            'name' => $school?->name ?? 'دبیرستان',
            'level_label' => match ($school?->level) {
                School::LEVEL_HIGH => 'دوره دوم متوسطه',
                School::LEVEL_MIDDLE => 'دوره اول متوسطه',
                School::LEVEL_ELEMENTARY => 'دوره ابتدایی',
                default => '—',
            },
        ];
    }

    /**
     * The ceiling a legacy line was published with. Cards written before the
     * ceiling was frozen into `data` fall back to the source grade item, keyed
     * by delivery: one lesson can hold a ۱۰۰-point exam and a ۲۰-point quiz.
     *
     * @return Collection<string, Collection<int, GradeItem>>
     */
    public function ceilingMap(Collection $cards): Collection
    {
        return GradeItem::query()
            ->with('classroomSubject')
            ->whereIn('student_id', $cards->pluck('student_id')->unique()->all() ?: [0])
            ->whereIn('term_id', $cards->pluck('term_id')->unique()->all() ?: [0])
            ->get()
            ->groupBy(fn (GradeItem $i) => $i->student_id.':'.$i->term_id.':'.($i->classroomSubject?->subject_id ?? 0).':'.$i->delivery);
    }

    /** @return array<string, mixed> */
    public function lineData(ReportCard $card, ReportCardLine $line, Collection $ceilings): array
    {
        $ceiling = $this->ceilingFor($ceilings, $card->kind, $card->student_id, $card->term_id, $line);

        return [
            'subject' => $line->subject?->title,
            'score' => $line->score,
            'max_score' => $line->data['max_score'] ?? $ceiling?->max_score,
            'source_type' => $line->data['source_type'] ?? $ceiling?->source_type,
            'teacher_comment' => $line->teacher_comment,
        ];
    }

    /** @return array<string, mixed> */
    private function printableLine(ReportCard $card, ReportCardLine $line, Collection $ceilings): array
    {
        $data = $this->lineData($card, $line, $ceilings);
        $score20 = $this->toTwenty($data['score'], $data['max_score']);
        $band = $this->band($score20);

        return [
            ...$data,
            'score20' => $score20,
            'score20_text' => $score20 === null ? '—' : Jalali::digits(number_format($score20, 2)),
            'raw_text' => $data['score'] === null
                ? '—'
                : ($data['max_score']
                    ? Jalali::digits($data['score']).' از '.Jalali::digits($data['max_score'])
                    : Jalali::digits($data['score'])),
            'source_label' => self::SOURCE_LABELS[$data['source_type'] ?? ''] ?? ($data['source_type'] ?? '—'),
            'band_key' => $band['key'] ?? null,
            'band_label' => $band['label'] ?? '—',
            'percent' => $score20 === null ? null : (int) round(($score20 / 20) * 100),
        ];
    }

    /** @return array<string, mixed>|null */
    public function band(?float $score20): ?array
    {
        if ($score20 === null) {
            return null;
        }

        foreach (self::BANDS as $band) {
            if ($score20 >= $band['min']) {
                return $band;
            }
        }

        return self::BANDS[count(self::BANDS) - 1];
    }

    public function toTwenty(int|float|null $score, int|float|null $max): ?float
    {
        if ($score === null) {
            return null;
        }

        if (! $max || (float) $max === 20.0) {
            return (float) $score;
        }

        return round(((float) $score / (float) $max) * 20, 2);
    }

    /** The card's mean on the /20 scale, before formatting. */
    public function averageValue(ReportCard $card, Collection $ceilings): ?float
    {
        $scores = $card->lines
            ->map(fn (ReportCardLine $l) => $this->toTwenty(
                $l->score,
                $l->data['max_score'] ?? $this->ceilingFor($ceilings, $card->kind, $card->student_id, $card->term_id, $l)?->max_score,
            ))
            ->filter()
            ->values();

        return $scores->isEmpty() ? null : $scores->sum() / $scores->count();
    }

    /** @return array{value: string, band: string}|null */
    private function average(ReportCard $card, Collection $ceilings): ?array
    {
        $avg = $this->averageValue($card, $ceilings);

        if ($avg === null) {
            return null;
        }

        return [
            'value' => Jalali::digits(number_format($avg, 2)),
            'band' => $this->band($avg)['label'] ?? '—',
        ];
    }

    /**
     * Class standing: where a card's mean sits among the published cards of
     * the same classroom, for the same term and delivery. Peers = classmates
     * (active enrollment) holding a published card of the same term and kind;
     * a learner counts once, at their newest published version. Equal means
     * share the better rank — like a podium, not a lottery. A class with a
     * single ranked card has no standing: a rank against nobody is not one.
     *
     * @param  Collection<int, ReportCard>  $cards
     * @return array<string, array{rank: int, of: int}> card ulid => standing
     */
    public function rankMap(Collection $cards): array
    {
        $studentIds = $cards->pluck('student_id')->unique()->all();

        if ($studentIds === []) {
            return [];
        }

        // Learner → classroom, so each card can find the peers it is judged against.
        $classrooms = Enrollment::query()
            ->where('status', Enrollment::STATUS_ACTIVE)
            ->whereIn('student_id', $studentIds)
            ->pluck('classroom_id', 'student_id');

        $termIds = $cards->pluck('term_id')->unique()->filter()->all();
        $kinds = $cards->pluck('kind')->unique()->filter()->all();

        if ($termIds === [] || $kinds === [] || $classrooms->isEmpty()) {
            return [];
        }

        // Only issued versions compete: a draft or a superseded sheet never
        // moves anybody's rank.
        $peers = ReportCard::query()
            ->with('lines')
            ->where('status', ReportCard::STATUS_PUBLISHED)
            ->whereIn('term_id', $termIds)
            ->whereIn('kind', $kinds)
            ->whereIn('student_id', $classrooms->keys()->all())
            ->get();

        $ceilings = $this->ceilingMap($peers);

        // classroom:term:kind → one slot per learner, newest published version.
        $groups = [];

        foreach ($peers as $peer) {
            $classroomId = $classrooms[$peer->student_id] ?? null;

            if ($classroomId === null) {
                continue;
            }

            $key = $classroomId.':'.$peer->term_id.':'.$peer->kind;
            $version = (int) $peer->version;

            if (! isset($groups[$key][$peer->student_id]) || $version > $groups[$key][$peer->student_id]['version']) {
                $groups[$key][$peer->student_id] = [
                    'ulid' => $peer->ulid,
                    'version' => $version,
                    'avg' => $this->averageValue($peer, $ceilings),
                ];
            }
        }

        $standings = [];

        foreach ($groups as $slots) {
            $ranked = collect($slots)
                ->filter(fn (array $slot) => $slot['avg'] !== null)
                ->sortByDesc(fn (array $slot) => round((float) $slot['avg'], 2))
                ->values();

            $of = $ranked->count();

            if ($of < 2) {
                continue;
            }

            $rank = 0;
            $previous = null;

            foreach ($ranked as $position => $slot) {
                $mean = round((float) $slot['avg'], 2);

                if ($previous === null || $mean !== $previous) {
                    $rank = $position + 1;
                    $previous = $mean;
                }

                $standings[$slot['ulid']] = ['rank' => $rank, 'of' => $of];
            }
        }

        return $standings;
    }

    /** @return array<string, int> band key => count */
    private function bandCounts(ReportCard $card, Collection $ceilings): array
    {
        $counts = array_fill_keys(array_column(self::BANDS, 'key'), 0);

        foreach ($card->lines as $line) {
            $score20 = $this->toTwenty(
                $line->score,
                $line->data['max_score'] ?? $this->ceilingFor($ceilings, $card->kind, $card->student_id, $card->term_id, $line)?->max_score,
            );
            $band = $this->band($score20);

            if ($band !== null) {
                $counts[$band['key']]++;
            }
        }

        return $counts;
    }

    /** @return array<int, string> student id => classroom title */
    private function classroomTitles(Collection $cards): array
    {
        return Enrollment::query()
            ->with('classroom')
            ->whereIn('student_id', $cards->pluck('student_id')->unique()->all() ?: [0])
            ->where('status', Enrollment::STATUS_ACTIVE)
            ->orderByDesc('id')
            ->get()
            ->groupBy('student_id')
            ->map(fn (Collection $rows) => $rows->first()?->classroom?->title)
            ->filter()
            ->all();
    }

    /** @return array<int, string> user id => full name */
    private function issuerNames(Collection $cards): array
    {
        $ids = $cards->pluck('published_by')->filter()->unique()->all();

        if ($ids === []) {
            return [];
        }

        return User::query()
            ->whereIn('id', $ids)
            ->get()
            ->mapWithKeys(fn (User $u) => [$u->id => $u->fullName()])
            ->all();
    }

    /** The grade item a legacy line was published from; identical score wins. */
    private function ceilingFor(Collection $ceilings, string $kind, int $studentId, int $termId, ReportCardLine $line): ?GradeItem
    {
        $bucket = $ceilings->get($studentId.':'.$termId.':'.$line->subject_id.':'.$kind);

        return $bucket?->first(fn (GradeItem $i) => (float) $i->score === (float) $line->score) ?? $bucket?->first();
    }
}
