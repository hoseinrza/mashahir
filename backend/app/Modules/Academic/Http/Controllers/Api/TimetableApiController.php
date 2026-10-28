<?php

namespace App\Modules\Academic\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Academic\Models\Classroom;
use App\Modules\Academic\Models\TimetableSlot;
use App\Support\Rbac\ScopeResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class TimetableApiController extends Controller
{
    public function __construct(private readonly ScopeResolver $resolver)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorize('academic.view');

        $data = $request->validate(['classroom_ulid' => ['nullable', 'string']]);

        $query = TimetableSlot::query()
            ->with(['classroomSubject.subject', 'classroomSubject.classroom']);

        if ($data['classroom_ulid'] ?? null) {
            $classroom = Classroom::query()->where('ulid', $data['classroom_ulid'])->firstOrFail();
            $query->whereHas('classroomSubject', fn ($q) => $q->where('classroom_id', $classroom->id));
        } else {
            // Teachers see their own plan (sh2).
            $classroomIds = $this->resolver->classroomIds();
            if ($classroomIds !== null) {
                $query->whereHas('classroomSubject', fn ($q) => $q->whereIn('classroom_id', $classroomIds ?: [0]));
            }
        }

        return response()->json([
            'data' => $query->orderBy('weekday')->orderBy('period')->get()->map(fn (TimetableSlot $s) => [
                'id' => $s->id,
                'weekday' => $s->weekday,
                'period' => $s->period,
                'starts_at' => $s->starts_at,
                'ends_at' => $s->ends_at,
                'classroom' => $s->classroomSubject?->classroom?->title,
                'classroom_ulid' => $s->classroomSubject?->classroom?->ulid,
                'subject' => $s->classroomSubject?->subject?->title,
                'teacher_ulid' => $s->classroomSubject?->teacher?->ulid,
            ]),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('timetable.manage');

        $data = $request->validate([
            'classroom_subject_id' => ['required', 'integer'],
            'weekday' => ['required', 'integer', 'min:0', 'max:6'],
            'period' => ['required', 'integer', 'min:1'],
            'starts_at' => ['required', 'date_format:H:i'],
            'ends_at' => ['required', 'date_format:H:i', 'after:starts_at'],
        ]);

        $exists = TimetableSlot::query()
            ->where('classroom_subject_id', $data['classroom_subject_id'])
            ->where('weekday', $data['weekday'])
            ->where('period', $data['period'])
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages(['period' => 'این زنگ برای این درس در این روز قبلاً ثبت شده است.']);
        }

        $slot = TimetableSlot::query()->create($data);

        return response()->json(['id' => $slot->id], 201);
    }

    public function update(Request $request, TimetableSlot $slot): JsonResponse
    {
        $this->authorize('timetable.manage');

        $data = $request->validate([
            'weekday' => ['sometimes', 'integer', 'min:0', 'max:6'],
            'period' => ['sometimes', 'integer', 'min:1'],
            'starts_at' => ['sometimes', 'date_format:H:i'],
            'ends_at' => ['sometimes', 'date_format:H:i', 'after:starts_at'],
        ]);

        $merged = [
            'weekday' => $data['weekday'] ?? $slot->weekday,
            'period' => $data['period'] ?? $slot->period,
        ];

        $duplicate = TimetableSlot::query()
            ->where('classroom_subject_id', $slot->classroom_subject_id)
            ->where('weekday', $merged['weekday'])
            ->where('period', $merged['period'])
            ->whereKeyNot($slot->id)
            ->exists();

        if ($duplicate) {
            throw ValidationException::withMessages(['period' => 'این زنگ برای این درس در این روز قبلاً ثبت شده است.']);
        }

        $slot->update($data);

        return response()->json(['id' => $slot->id] + $slot->only(['weekday', 'period', 'starts_at', 'ends_at']));
    }

    public function destroy(TimetableSlot $slot): JsonResponse
    {
        $this->authorize('timetable.manage');

        $slot->delete();

        return response()->noContent();
    }
}
