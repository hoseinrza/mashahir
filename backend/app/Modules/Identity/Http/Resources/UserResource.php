<?php

namespace App\Modules\Identity\Http\Resources;

use App\Modules\Identity\Models\UserRole;
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
            // Store response only: false = an existing platform account was
            // attached to the school instead of being created.
            'fresh_account' => $this->when($this->wasRecentlyCreated, fn () => true),
            // sh8: support sees minimal data only.
            'phone' => $this->when(! $minimal, fn () => $this->phone),
            'last_login_at' => $this->when(! $minimal, fn () => $this->last_login_at?->toIso8601String()),
            // Active role assignments in the viewing school — the UI needs
            // user_role_id to offer "end role" (DELETE /users/{user}/roles/{role}).
            'roles' => $this->when($this->relationLoaded('userRoles') && ! $minimal, fn () => $this->userRoles
                ->map(fn (UserRole $assignment) => [
                    'user_role_id' => $assignment->id,
                    'role_key' => $assignment->role?->key,
                    'role_title' => $assignment->role?->title,
                    'scope_type' => $assignment->scope_type,
                    'scope_id' => $assignment->scope_id,
                    'starts_on' => $assignment->starts_on?->toDateString(),
                    'ends_on' => $assignment->ends_on?->toDateString(),
                ])),
        ];
    }
}
