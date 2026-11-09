<?php

namespace App\Modules\Transport\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Audit\Services\AuditService;
use App\Modules\People\Models\Student;
use App\Modules\Transport\Models\BusAssignment;
use App\Modules\Transport\Models\BusBoarding;
use App\Modules\Transport\Models\BusRoute;
use App\Modules\Transport\Models\BusStop;
use App\Support\Rbac\PermissionRegistrar;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * سرویس مدرسه: خطوط، ایستگاه‌ها، تخصیص دانش‌آموز و ثبت سوار/پیاده‌شدن.
 * راننده با نقش سفارشی transport.board فقط خط خودش را می‌بیند.
 */
class TransportApiController extends Controller
{
    public function __construct(private readonly AuditService $audit)
    {
    }

    public function index(): JsonResponse
    {
        $this->authorize('transport.view');

        $query = BusRoute::query()->with(['stops', 'driver'])->withCount('assignments')->orderBy('code');

        $roleKey = app(PermissionRegistrar::class)->activeRole()?->role->key;
        if ($roleKey !== null && ! in_array($roleKey, ['school_admin', 'office_manager', 'discipline_deputy'], true)) {
            $query->where('driver_user_id', auth()->id());
        }

        return response()->json([
            'data' => $query->get()->map(fn (BusRoute $route) => $this->routePayload($route)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('transport.manage');

        $data = $request->validate([
            'code' => ['required', 'string', 'max:30'],
            'title' => ['required', 'string', 'max:200'],
            'driver_ulid' => ['nullable', 'string', 'size:26'],
            'vehicle_model' => ['nullable', 'string', 'max:100'],
            'plate_number' => ['nullable', 'string', 'max:30'],
            'capacity' => ['sometimes', 'integer', 'min:0', 'max:100'],
        ]);

        $existing = BusRoute::query()->where('code', $data['code'])->exists();
        if ($existing) {
            throw ValidationException::withMessages(['code' => 'خطی با این کد از قبل ثبت شده است.']);
        }

        $driverId = $this->driverIdFromUlid($data['driver_ulid'] ?? null);

        $route = BusRoute::query()->create([
            'code' => $data['code'],
            'title' => $data['title'],
            'driver_user_id' => $driverId,
            'vehicle_model' => $data['vehicle_model'] ?? null,
            'plate_number' => $data['plate_number'] ?? null,
            'capacity' => $data['capacity'] ?? 0,
            'is_active' => true,
        ]);

        $this->audit->log('transport.route_created', $route, new: [
            'code' => $route->code,
            'title' => $route->title,
        ]);

        return response()->json($this->routePayload($route->fresh(['stops', 'driver'])), 201);
    }

    public function update(Request $request, BusRoute $route): JsonResponse
    {
        $this->authorize('transport.manage');

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:200'],
            'driver_ulid' => ['sometimes', 'nullable', 'string', 'size:26'],
            'vehicle_model' => ['sometimes', 'nullable', 'string', 'max:100'],
            'plate_number' => ['sometimes', 'nullable', 'string', 'max:30'],
            'capacity' => ['sometimes', 'integer', 'min:0', 'max:100'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('driver_ulid', $data)) {
            $data['driver_user_id'] = $this->driverIdFromUlid($data['driver_ulid']);
            unset($data['driver_ulid']);
        }

        $old = $route->only(['title', 'driver_user_id', 'capacity', 'is_active']);
        $route->update($data);

        $this->audit->log('transport.route_updated', $route, old: $old, new: $data);

        return response()->json($this->routePayload($route->fresh(['stops', 'driver'])));
    }

    public function addStop(Request $request, BusRoute $route): JsonResponse
    {
        $this->authorize('transport.manage');

        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'position' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'pickup_time' => ['nullable', 'date_format:H:i'],
        ]);

        $stop = BusStop::query()->create([
            'bus_route_id' => $route->id,
            'title' => $data['title'],
            'position' => $data['position'] ?? ((int) $route->stops()->max('position') + 1),
            'pickup_time' => $data['pickup_time'] ?? null,
        ]);

        return response()->json([
            'ulid' => $stop->ulid,
            'title' => $stop->title,
            'position' => $stop->position,
            'pickup_time' => $stop->pickup_time,
        ], 201);
    }

    public function removeStop(BusRoute $route, BusStop $stop): JsonResponse
    {
        $this->authorize('transport.manage');

        if ((int) $stop->bus_route_id !== (int) $route->id) {
            abort(404);
        }

        $stop->delete();

        return response()->noContent();
    }

    public function assignStudent(Request $request, BusRoute $route): JsonResponse
    {
        $this->authorize('transport.manage');

        $data = $request->validate([
            'student_ulid' => ['required', 'string'],
            'bus_stop_ulid' => ['nullable', 'string', 'size:26'],
        ]);

        $student = Student::query()->where('ulid', $data['student_ulid'])->firstOrFail();

        $stopId = null;
        if (($data['bus_stop_ulid'] ?? null) !== null) {
            $stop = BusStop::query()
                ->where('ulid', $data['bus_stop_ulid'])
                ->where('bus_route_id', $route->id)
                ->first();

            if ($stop === null) {
                throw ValidationException::withMessages(['bus_stop_ulid' => 'این ایستگاه به خط انتخاب‌شده تعلق ندارد.']);
            }

            $stopId = $stop->id;
        }

        $assignment = BusAssignment::query()->updateOrCreate(
            ['bus_route_id' => $route->id, 'student_id' => $student->id],
            ['bus_stop_id' => $stopId],
        );

        $this->audit->log('transport.student_assigned', $student, new: [
            'route_ulid' => $route->ulid,
            'assignment_id' => $assignment->id,
        ]);

        return response()->json(['assignment_id' => $assignment->id], 201);
    }

    public function unassignStudent(BusRoute $route, string $studentUlid): JsonResponse
    {
        $this->authorize('transport.manage');

        $studentId = Student::query()->where('ulid', $studentUlid)->value('id');

        $assignment = BusAssignment::query()
            ->where('bus_route_id', $route->id)
            ->where('student_id', $studentId ?? 0)
            ->first();

        if ($assignment === null) {
            abort(404);
        }

        $assignment->delete();

        return response()->noContent();
    }

    /**
     * نمای راننده: خط خودش، دانش‌آموزان و وضعیت سوار/پیادهٔ امروز.
     */
    public function myRoute(): JsonResponse
    {
        $this->authorize('transport.board');

        $route = BusRoute::query()
            ->with(['stops', 'assignments.student', 'assignments.stop'])
            ->where('driver_user_id', auth()->id())
            ->where('is_active', true)
            ->first();

        if ($route === null) {
            return response()->json(['route' => null, 'roster' => [], 'boardings' => []]);
        }

        $today = now()->toDateString();

        $boardings = BusBoarding::query()
            ->where('bus_route_id', $route->id)
            ->where('boarding_date', $today)
            ->get()
            ->map(fn (BusBoarding $row) => [
                'student_id' => $row->student_id,
                'direction' => $row->direction,
                'status' => $row->status,
                'recorded_at' => $row->recorded_at?->toIso8601String(),
            ]);

        $roster = $route->assignments->map(fn (BusAssignment $assignment) => [
            'student_ulid' => $assignment->student?->ulid,
            'student_name' => $assignment->student?->fullName(),
            'student_code' => $assignment->student?->student_code,
            'stop_ulid' => $assignment->stop?->ulid,
            'stop_title' => $assignment->stop?->title,
            'pickup_time' => $assignment->stop?->pickup_time,
        ]);

        return response()->json([
            'route' => $this->routePayload($route),
            'roster' => $roster,
            'boardings' => $boardings,
        ]);
    }

    /**
     * ثبت سوار/پیاده‌شدن؛ هر ردیف در روز جاری upsert می‌شود.
     */
    public function markBoarding(Request $request): JsonResponse
    {
        $this->authorize('transport.board');

        $data = $request->validate([
            'route_ulid' => ['required', 'string', 'size:26'],
            'student_ulid' => ['required', 'string', 'size:26'],
            'direction' => ['required', Rule::in([BusBoarding::DIRECTION_IN, BusBoarding::DIRECTION_OUT])],
            'status' => ['required', Rule::in([BusBoarding::STATUS_BOARDED, BusBoarding::STATUS_ABSENT])],
        ]);

        $route = BusRoute::query()->where('ulid', $data['route_ulid'])->firstOrFail();

        // The driver may only touch his own route; staff with manage may help.
        $roleKey = app(PermissionRegistrar::class)->activeRole()?->role->key;
        $isOffice = in_array($roleKey, ['school_admin', 'office_manager'], true);

        if (! $isOffice && (int) $route->driver_user_id !== (int) auth()->id()) {
            abort(403);
        }

        $student = Student::query()->where('ulid', $data['student_ulid'])->firstOrFail();

        $assigned = BusAssignment::query()
            ->where('bus_route_id', $route->id)
            ->where('student_id', $student->id)
            ->exists();

        if (! $assigned) {
            throw ValidationException::withMessages(['student_ulid' => 'این دانش‌آموز به این خط تخصیص نیافته است.']);
        }

        $boarding = BusBoarding::query()->updateOrCreate(
            [
                'bus_route_id' => $route->id,
                'student_id' => $student->id,
                'boarding_date' => now()->toDateString(),
                'direction' => $data['direction'],
            ],
            [
                'status' => $data['status'],
                'recorded_by' => auth()->id(),
                'recorded_at' => now(),
            ],
        );

        return response()->json([
            'student_ulid' => $student->ulid,
            'direction' => $boarding->direction,
            'status' => $boarding->status,
            'recorded_at' => $boarding->recorded_at?->toIso8601String(),
        ]);
    }

    private function routePayload(BusRoute $route): array
    {
        return [
            'ulid' => $route->ulid,
            'code' => $route->code,
            'title' => $route->title,
            'driver' => $route->driver ? [
                'ulid' => $route->driver->ulid,
                'name' => $route->driver->fullName(),
            ] : null,
            'vehicle_model' => $route->vehicle_model,
            'plate_number' => $route->plate_number,
            'capacity' => $route->capacity,
            'is_active' => (bool) $route->is_active,
            'stops' => $route->relationLoaded('stops')
                ? $route->stops->map(fn (BusStop $stop) => [
                    'ulid' => $stop->ulid,
                    'title' => $stop->title,
                    'position' => $stop->position,
                    'pickup_time' => $stop->pickup_time,
                ])
                : [],
            'students_count' => (int) ($route->assignments_count ?? $route->assignments()->count()),
        ];
    }

    private function driverIdFromUlid(?string $ulid): ?int
    {
        if ($ulid === null) {
            return null;
        }

        $driver = \App\Modules\Identity\Models\User::query()->where('ulid', $ulid)->first();

        if ($driver === null) {
            throw ValidationException::withMessages(['driver_ulid' => 'راننده یافت نشد.']);
        }

        return $driver->id;
    }
}
