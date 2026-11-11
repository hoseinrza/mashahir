<?php

namespace App\Modules\People\Http\Resources;

use App\Support\Rbac\PermissionRegistrar;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * national_code is NEVER serialized here — it lives behind its own
 * reason-logged endpoint (students.view_national_code, sh7).
 */
class StudentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $minimal = app(PermissionRegistrar::class)->conditionFor('students.view') === 'sh8';

        return [
            'ulid' => $this->ulid,
            'student_code' => $this->student_code,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'status' => $this->status,
            'birth_date' => $this->when(! $minimal, fn () => $this->birth_date?->toDateString()),
            // Current active classroom, when the controller eager-loaded it.
            'classroom_title' => $this->when($this->relationLoaded('enrollments'), fn () => $this->enrollments
                ->first()?->classroom?->title),
        ];
    }
}
