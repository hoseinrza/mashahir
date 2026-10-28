<?php

namespace App\Modules\Identity\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Audit\Services\AuditService;
use App\Modules\Identity\Http\Resources\UserResource;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Models\UserRole;
use App\Modules\Identity\Policies\UserPolicy;
use App\Support\PhoneHash;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UsersApiController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', User::class);

        $users = User::query()
            ->whereHas('userRoles', fn ($q) => $q->where('school_id', $request->attributes->get('school_id')))
            ->orderBy('last_name')
            ->paginate(min($request->integer('per_page', 50), 100));

        return UserResource::collection($users);
    }

    public function store(Request $request): UserResource
    {
        $this->authorize('create', User::class);

        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'phone' => ['required', 'string', 'min:10', 'max:20'],
        ]);

        $phoneHash = PhoneHash::of($data['phone']);

        if (User::query()->where('phone_hash', $phoneHash)->exists()) {
            throw ValidationException::withMessages(['phone' => 'این شماره قبلاً ثبت شده است.']);
        }

        $user = User::query()->create($data + ['phone_hash' => $phoneHash]);

        return new UserResource($user);
    }

    public function update(Request $request, User $user): UserResource
    {
        $this->authorize('update', $user);

        $data = $request->validate([
            'first_name' => ['sometimes', 'string', 'max:100'],
            'last_name' => ['sometimes', 'string', 'max:100'],
        ]);

        $user->update($data);

        return new UserResource($user->fresh());
    }

    /**
     * sh7 / sh10: phone (login) changes are reason-logged, never silent.
     */
    public function updatePhone(Request $request, User $user): UserResource
    {
        $this->authorize('updatePhone', $user);

        $data = $request->validate([
            'phone' => ['required', 'string', 'min:10', 'max:20'],
            'reason' => ['required', 'string', 'min:5'],
        ]);

        $phoneHash = PhoneHash::of($data['phone']);

        if ($phoneHash !== $user->phone_hash
            && User::query()->where('phone_hash', $phoneHash)->exists()) {
            throw ValidationException::withMessages(['phone' => 'این شماره قبلاً ثبت شده است.']);
        }

        $old = $user->only(['phone']);
        $user->forceFill(['phone' => $data['phone'], 'phone_hash' => $phoneHash])->save();

        app(AuditService::class)->log(
            'user.phone_changed',
            $user,
            old: ['phone' => '***masked***'],
            new: ['phone' => '***masked***', 'phone_hash' => $phoneHash],
            reason: $data['reason'],
        );

        return new UserResource($user->fresh());
    }

    public function assignRole(Request $request, User $user, UserPolicy $policy): UserRole
    {
        $data = $request->validate([
            'role_key' => ['required', 'string'],
            'scope_type' => ['required', Rule::in(['school', 'classroom', 'student'])],
            'scope_id' => ['nullable', 'integer', 'required_if:scope_type,classroom,student'],
            'starts_on' => ['nullable', 'date'],
            'ends_on' => ['nullable', 'date'],
        ]);

        if (! $policy->assignRole($request->user(), $data['role_key'])) {
            abort(403, 'Assigning this role is not allowed.');
        }

        // System roles are global; custom roles belong to the active school.
        $roleId = \DB::table('roles')
            ->where(function ($q) use ($request) {
                $q->whereNull('school_id')
                  ->orWhere('school_id', $request->attributes->get('school_id'));
            })
            ->where('key', $data['role_key'])
            ->value('id');

        if ($roleId === null) {
            throw ValidationException::withMessages(['role_key' => 'نقش یافت نشد.']);
        }

        $assignment = UserRole::query()->create([
            'user_id' => $user->id,
            'role_id' => $roleId,
            'school_id' => $request->attributes->get('school_id'),
            'scope_type' => $data['scope_type'],
            'scope_id' => $data['scope_id'] ?? null,
            'starts_on' => $data['starts_on'] ?? now()->toDateString(),
            'ends_on' => $data['ends_on'] ?? null,
        ]);

        app(AuditService::class)->log('user.role_assigned', $user, new: $data);

        return $assignment;
    }

    /**
     * Ending a role cuts access immediately (ends_on = today).
     */
    public function endRole(Request $request, User $user, UserRole $role): UserRole
    {
        $this->authorize('endRole', $user);

        if ($role->user_id !== $user->id || $role->school_id !== $request->attributes->get('school_id')) {
            abort(404);
        }

        $data = $request->validate([
            'reason' => ['required', 'string', 'min:5'],
            // Explicit future date = cooperation ends later; omitted = cut NOW.
            'ends_on' => ['nullable', 'date'],
        ]);

        $endsOn = $data['ends_on'] ?? now()->subDay()->toDateString();

        $role->forceFill(['ends_on' => $endsOn])->save();

        app(AuditService::class)->log(
            'user.role_ended',
            $user,
            old: ['ends_on' => null],
            new: ['ends_on' => $endsOn, 'user_role_id' => $role->id],
            reason: $data['reason'],
        );

        return $role->fresh();
    }
}
