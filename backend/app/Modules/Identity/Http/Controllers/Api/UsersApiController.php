<?php

namespace App\Modules\Identity\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Audit\Services\AuditService;
use App\Modules\Identity\Http\Resources\UserResource;
use App\Modules\Identity\Models\StaffProfile;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Models\UserRole;
use App\Modules\Identity\Policies\UserPolicy;
use App\Modules\Identity\Services\AdminPasswordService;
use App\Support\PhoneHash;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UsersApiController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', User::class);

        $schoolId = $request->attributes->get('school_id');
        $isPlatformContext = $request->attributes->get('user_role')?->role?->key === 'platform_admin';

        // Platform console is school-agnostic: EVERY account on the platform
        // is listed — other schools' staff and role-less accounts included —
        // so no school can be missing from the list and any role-less
        // account can receive its role from here. Each role is labeled with
        // its school's name for the cross-school view. Students have their own
        // tab, so an account that signs in as a student is never a staff row
        // here — in either console. Guardians are not affected.
        if ($isPlatformContext) {
            $users = User::query()
                ->with(['userRoles' => fn ($q) => $q->active()->with(['role', 'school'])])
                ->whereDoesntHave('userRoles', fn ($ur) => $ur->active()
                    ->whereHas('role', fn ($r) => $r->where('key', 'student')))
                ->orderBy('last_name')
                ->paginate(min($request->integer('per_page', 50), 100));

            return UserResource::collection($users);
        }

        // Affiliation, not roles: a freshly created account holds no role yet
        // but must still be listed, otherwise its role could never be
        // assigned from the table. Roles alone cover pre-staff-profile users.
        // Platform-role rows never count as affiliation and never surface in
        // the role chips: the platform admin is not a member of this school.
        $users = User::query()
            ->where(
                fn ($q) => $q->whereHas('staffProfiles', fn ($sp) => $sp->where('school_id', $schoolId))
                    ->orWhereHas('userRoles', fn ($ur) => $ur->where('school_id', $schoolId)->active()
                        ->whereHas('role', fn ($r) => $r->whereNotIn('key', ['platform_admin', 'student']))),
            )
            ->whereDoesntHave('userRoles', fn ($ur) => $ur->where('school_id', $schoolId)->active()
                ->whereHas('role', fn ($r) => $r->where('key', 'student')))
            ->with(['userRoles' => fn ($q) => $q->active()
                ->where('school_id', $schoolId)
                ->whereHas('role', fn ($r) => $r->whereNotIn('key', ['platform_admin', 'student']))
                ->with(['role', 'school'])])
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

        // The account itself is platform-global; the school link lives in
        // staff_profiles. An existing account (self-registered or from
        // another school) is attached here instead of erroring — only a
        // duplicate membership within THIS school is rejected.
        $user = User::query()->where('phone_hash', $phoneHash)->first();

        if ($user !== null
            && $user->staffProfiles()->where('school_id', $request->attributes->get('school_id'))->exists()) {
            throw ValidationException::withMessages(['phone' => 'این شماره قبلاً در همین مدرسه ثبت شده است.']);
        }

        if ($user === null) {
            $user = User::query()->create($data + ['phone_hash' => $phoneHash]);
        }

        // Membership without a role: the user is visible in the personnel
        // list immediately so the role can be assigned from the same table.
        $user->staffProfiles()->create(['status' => 'active']);

        app(AuditService::class)->log('user.created', $user, new: $data);

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

    /**
     * sh7/sh10: setting or replacing a user's login password (username stays
     * the mobile number) is reason-logged and audited — the plaintext never
     * reaches the trail. Same conditions as updatePhone.
     */
    public function setPassword(Request $request, User $user, AdminPasswordService $passwords): UserResource
    {
        $this->authorize('setPassword', $user);

        $data = $request->validate([
            'password' => ['required', 'string', 'min:8', 'max:64'],
            'reason' => ['required', 'string', Rule::in(AdminPasswordService::reasons())],
        ]);

        return new UserResource($passwords->set($user, $data['password'], $data['reason']));
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

        // Students are not personnel: the student role is student-scoped and
        // only the student-record flow mints it — never the role form.
        if ($data['role_key'] === 'student') {
            throw ValidationException::withMessages([
                'role_key' => 'نقش «دانش‌آموز» از این فرم تخصیص داده نمی‌شود؛ دانش‌آموز را از تب دانش‌آموزان ثبت کنید.',
            ]);
        }

        if (! $policy->assignRole($request->user(), $data['role_key'])) {
            abort(403, 'Assigning this role is not allowed.');
        }

        // School-scoped assignments must land inside a school; the platform
        // context (school_id = null) hands out only the platform role itself.
        if ($data['role_key'] !== 'platform_admin' && $request->attributes->get('school_id') === null) {
            throw ValidationException::withMessages([
                'role_key' => 'برای تخصیص نقشِ مدرسه‌ای باید در کانتکست یک مدرسه باشید.',
            ]);
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

        // The platform context ends any assignment platform-wide (its list
        // spans every school); a school context only ends roles of its own
        // school — anything else is simply not visible to it (404).
        $isPlatformContext = $request->attributes->get('user_role')?->role?->key === 'platform_admin';

        if ($role->user_id !== $user->id
            || (! $isPlatformContext && $role->school_id !== $request->attributes->get('school_id'))) {
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

    /**
     * Deleting a user. School context detaches the membership: the roles of
     * THIS school end now and its staff profile row is removed, so the user
     * disappears from the school's list while the platform account itself
     * survives for its other schools. The platform context may hard-delete a
     * true ghost account — no memberships, no roles, no family links
     * anywhere. Both paths are reason-logged (sh7 pattern).
     */
    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->authorize('destroy', $user);

        $data = $request->validate(['reason' => ['required', 'string', 'min:5']]);

        if ($request->user()->id === $user->id) {
            throw ValidationException::withMessages(['user' => 'حذف حساب خودتان ممکن نیست.']);
        }
        $isPlatformContext = $request->attributes->get('user_role')?->role?->key === 'platform_admin';

        if ($isPlatformContext) {
            $linked = $user->userRoles()->exists()
                || $user->staffProfiles()->exists()
                || \DB::table('guardian_links')->where('guardian_user_id', $user->id)->exists()
                || \DB::table('students')->where('user_id', $user->id)->exists();

            if ($linked) {
                throw ValidationException::withMessages([
                    'user' => 'این حساب عضو یک مدرسه یا خانواده است؛ نخست عضویت او را از لیست همان مدرسه حذف کنید.',
                ]);
            }

            app(AuditService::class)->log('user.deleted', $user, old: ['name' => $user->fullName()], reason: $data['reason']);
            $user->delete();

            return response()->json(['message' => 'حساب برای همیشه حذف شد.']);
        }

        $ended = UserRole::query()
            ->where('user_id', $user->id)
            ->where('school_id', $request->attributes->get('school_id'))
            ->active()
            ->update(['ends_on' => now()->subDay()->toDateString()]);

        StaffProfile::query()
            ->where('user_id', $user->id)
            ->where('school_id', $request->attributes->get('school_id'))
            ->delete();

        app(AuditService::class)->log('user.detached', $user, old: ['ended_roles' => $ended], reason: $data['reason']);

        return response()->json(['message' => 'کاربر از این مدرسه حذف شد؛ حساب پلتفرمی او برای مدارس دیگر باقی ماند.']);
    }
}
