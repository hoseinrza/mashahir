<?php

namespace App\Modules\Academic\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClassroomResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'ulid' => $this->ulid,
            'title' => $this->title,
            'grade_level' => ['title' => $this->gradeLevel?->title],
            'academic_year' => ['title' => $this->academicYear?->title],
        ];
    }
}
