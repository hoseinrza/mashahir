<?php

namespace App\Modules\Identity\Http\Resources;

use App\Support\Rbac\PermissionRegistrar;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $minimal = app(PermissionRegistrar::class)->conditionFor('users.view') === 'sh8';

        return [
            'ulid' => $this->ulid,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'status' => $this->status,
            // sh8: support sees minimal data only.
            'phone' => $this->when(! $minimal, fn () => $this->phone),
            'last_login_at' => $this->when(! $minimal, fn () => $this->last_login_at?->toIso8601String()),
        ];
    }
}
