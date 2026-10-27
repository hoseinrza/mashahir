<?php

namespace App\Modules\People\Http\Resources;

use App\Modules\People\Services\GuardianAccessService;
use App\Support\Rbac\PermissionRegistrar;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GuardianLinkResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var GuardianAccessService $access */
        $access = app(GuardianAccessService::class);
        $isGuardianViewer = app(PermissionRegistrar::class)->activeRole()?->role->key === 'guardian';

        return [
            'id' => $this->id,
            'student_ulid' => $this->student?->ulid,
            'student_name' => $this->student?->fullName(),
            'link_type' => $this->link_type,
            'status' => $this->status,
            'ends_on' => $this->ends_on?->toDateString(),
            'effective_flags' => $access->effectiveFlags($this->resource),
            // A guardian never sees another guardian's identity or contact.
            'guardian' => $this->when(! $isGuardianViewer, fn () => [
                'ulid' => $this->guardian?->ulid,
                'name' => $this->guardian?->fullName(),
            ]),
        ];
    }
}
