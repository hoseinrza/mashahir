<?php

namespace App\Modules\Pta\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Audit\Services\AuditService;
use App\Modules\Pta\Models\PtaMeeting;
use App\Modules\Pta\Models\PtaSurvey;
use App\Modules\Pta\Models\PtaVote;
use App\Support\Rbac\PermissionRegistrar;
use App\Support\Rbac\ScopeResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * انجمن اولیا و مربیان: جلسات و صورت‌جلسه، نظرسنجی با سیاست ضدتکرار رأی.
 * رأی‌دادن فقط برای اولیا (pta.vote) و ساخت/ویرایش فقط با pta.manage.
 */
class PtaApiController extends Controller
{
    public function __construct(
        private readonly ScopeResolver $resolver,
        private readonly PermissionRegistrar $registrar,
        private readonly AuditService $audit,
    ) {
    }

    public function meetings(): JsonResponse
    {
        $this->authorize('pta.view');

        $rows = PtaMeeting::query()
            ->orderByDesc('held_at')
            ->limit(100)
            ->get()
            ->map(fn (PtaMeeting $meeting) => $this->meetingPayload($meeting));

        return response()->json(['data' => $rows]);
    }

    public function storeMeeting(Request $request): JsonResponse
    {
        $this->authorize('pta.manage');

        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'held_at' => ['required', 'date'],
            'location' => ['nullable', 'string', 'max:200'],
            'agenda' => ['nullable', 'array', 'max:30'],
            'agenda.*' => ['string', 'max:300'],
            'minutes' => ['nullable', 'string', 'max:20000'],
            'resolutions' => ['nullable', 'array', 'max:30'],
            'resolutions.*' => ['string', 'max:300'],
        ]);

        $meeting = PtaMeeting::query()->create([
            'title' => $data['title'],
            'held_at' => $data['held_at'],
            'location' => $data['location'] ?? null,
            'agenda' => $data['agenda'] ?? null,
            'minutes' => $data['minutes'] ?? null,
            'resolutions' => $data['resolutions'] ?? null,
            'status' => PtaMeeting::STATUS_UPCOMING,
            'created_by' => $request->user()->id,
        ]);

        $this->audit->log('pta.meeting_created', $meeting, new: ['title' => $meeting->title]);

        return response()->json($this->meetingPayload($meeting), 201);
    }

    public function updateMeeting(Request $request, PtaMeeting $meeting): JsonResponse
    {
        $this->authorize('pta.manage');

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:200'],
            'held_at' => ['sometimes', 'date'],
            'location' => ['sometimes', 'nullable', 'string', 'max:200'],
            'status' => ['sometimes', Rule::in([
                PtaMeeting::STATUS_UPCOMING,
                PtaMeeting::STATUS_HELD,
                PtaMeeting::STATUS_CANCELLED,
            ])],
            'agenda' => ['sometimes', 'nullable', 'array', 'max:30'],
            'agenda.*' => ['string', 'max:300'],
            'minutes' => ['sometimes', 'nullable', 'string', 'max:20000'],
            'resolutions' => ['sometimes', 'nullable', 'array', 'max:30'],
            'resolutions.*' => ['string', 'max:300'],
        ]);

        $old = $meeting->only(['title', 'status', 'held_at']);
        $meeting->update($data);

        $this->audit->log('pta.meeting_updated', $meeting, old: $old, new: $data);

        return response()->json($this->meetingPayload($meeting->fresh()));
    }

    public function surveys(): JsonResponse
    {
        $this->authorize('pta.view');

        $canManage = $this->registrar->allows('pta.manage');
        $myVotes = PtaVote::query()
            ->where('user_id', auth()->id())
            ->pluck('option_id', 'pta_survey_id');

        $rows = PtaSurvey::query()
            ->with('votes')
            ->orderByDesc('id')
            ->limit(100)
            ->get()
            ->map(fn (PtaSurvey $survey) => $this->surveyPayload(
                $survey,
                $myVotes[$survey->id] ?? null,
                $canManage,
            ));

        return response()->json(['data' => $rows]);
    }

    public function storeSurvey(Request $request): JsonResponse
    {
        $this->authorize('pta.manage');

        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:2000'],
            'options' => ['required', 'array', 'min:2', 'max:10'],
            'options.*.id' => ['nullable', 'string', 'max:50'],
            'options.*.text' => ['required', 'string', 'max:200'],
            'policy' => ['sometimes', Rule::in([PtaSurvey::POLICY_PER_GUARDIAN, PtaSurvey::POLICY_PER_FAMILY])],
            'closes_at' => ['nullable', 'date', 'after:now'],
        ]);

        $options = [];
        foreach ($data['options'] as $index => $option) {
            $options[] = [
                'id' => $option['id'] ?? 'opt_'.($index + 1),
                'text' => $option['text'],
            ];
        }

        $survey = PtaSurvey::query()->create([
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'options' => $options,
            'policy' => $data['policy'] ?? PtaSurvey::POLICY_PER_GUARDIAN,
            'closes_at' => $data['closes_at'] ?? null,
            'is_active' => true,
            'created_by' => $request->user()->id,
        ]);

        $this->audit->log('pta.survey_created', $survey, new: ['title' => $survey->title]);

        return response()->json($this->surveyPayload($survey->fresh('votes'), null, true), 201);
    }

    public function updateSurvey(Request $request, PtaSurvey $survey): JsonResponse
    {
        $this->authorize('pta.manage');

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:200'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'is_active' => ['sometimes', 'boolean'],
            'closes_at' => ['sometimes', 'nullable', 'date'],
        ]);

        $survey->update($data);

        $this->audit->log('pta.survey_updated', $survey, new: $data);

        return response()->json($this->surveyPayload($survey->fresh('votes'), null, true));
    }

    public function vote(Request $request, PtaSurvey $survey): JsonResponse
    {
        $this->authorize('pta.vote');

        $data = $request->validate([
            'option_id' => ['required', 'string', 'max:50'],
        ]);

        if (! $survey->isOpen()) {
            throw ValidationException::withMessages(['option_id' => 'این نظرسنجی بسته شده است.']);
        }

        $optionIds = collect($survey->options ?? [])->pluck('id')->all();
        if (! in_array($data['option_id'], $optionIds, true)) {
            throw ValidationException::withMessages(['option_id' => 'این گزینه در نظرسنجی وجود ندارد.']);
        }

        $userId = (int) $request->user()->id;

        if (PtaVote::query()->where('pta_survey_id', $survey->id)->where('user_id', $userId)->exists()) {
            throw ValidationException::withMessages(['option_id' => 'شما قبلاً در این نظرسنجی رأی داده‌اید.']);
        }

        $familyKey = $this->familyKey($survey, $userId);

        if ($survey->policy === PtaSurvey::POLICY_PER_FAMILY) {
            $familyVoted = PtaVote::query()
                ->where('pta_survey_id', $survey->id)
                ->where('family_key', $familyKey)
                ->exists();

            if ($familyVoted) {
                throw ValidationException::withMessages(['option_id' => 'از این خانواده قبلاً یک رأی ثبت شده است.']);
            }
        }

        $vote = PtaVote::query()->create([
            'pta_survey_id' => $survey->id,
            'user_id' => $userId,
            'family_key' => $familyKey,
            'option_id' => $data['option_id'],
        ]);

        $this->audit->log('pta.vote_cast', $survey, new: ['option_id' => $vote->option_id]);

        return response()->json(
            $this->surveyPayload($survey->fresh('votes'), $vote->option_id, false),
        );
    }

    /**
     * per_guardian → each account owns one ballot; per_family → all guardians
     * of the same learner share one ballot (smallest linked student id).
     */
    private function familyKey(PtaSurvey $survey, int $userId): string
    {
        if ($survey->policy !== PtaSurvey::POLICY_PER_FAMILY) {
            return 'u:'.$userId;
        }

        $studentIds = $this->resolver->studentIds() ?? [];
        $anchor = $studentIds === [] ? null : min(array_map('intval', $studentIds));

        return $anchor === null ? 'u:'.$userId : 's:'.$anchor;
    }

    private function meetingPayload(PtaMeeting $meeting): array
    {
        return [
            'ulid' => $meeting->ulid,
            'title' => $meeting->title,
            'held_at' => $meeting->held_at?->toIso8601String(),
            'location' => $meeting->location,
            'agenda' => $meeting->agenda ?? [],
            'minutes' => $meeting->minutes,
            'resolutions' => $meeting->resolutions ?? [],
            'status' => $meeting->status,
            'created_at' => $meeting->created_at?->toIso8601String(),
        ];
    }

    private function surveyPayload(PtaSurvey $survey, ?string $myVote, bool $canManage): array
    {
        $counts = $survey->votes->groupBy('option_id')->map->count();

        return [
            'ulid' => $survey->ulid,
            'title' => $survey->title,
            'description' => $survey->description,
            'policy' => $survey->policy,
            'closes_at' => $survey->closes_at?->toIso8601String(),
            'is_active' => (bool) $survey->is_active,
            'is_open' => $survey->isOpen(),
            'options' => collect($survey->options ?? [])->map(fn (array $option) => [
                'id' => $option['id'],
                'text' => $option['text'],
                'votes' => (int) ($counts[$option['id']] ?? 0),
            ])->values(),
            'total_votes' => $survey->votes->count(),
            'my_vote' => $myVote,
            'can_manage' => $canManage,
        ];
    }
}
